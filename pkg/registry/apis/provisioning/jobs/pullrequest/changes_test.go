package pullrequest

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCalculateChanges(t *testing.T) {
	parser := resources.NewMockParser(t)
	reader := repository.NewMockReader(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	finfo := &repository.FileInfo{
		Path: "path/to/file.json",
		Ref:  "ref",
		Data: []byte("xxxx"), // not a valid JSON!
	}
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": resources.DashboardResource.GroupVersion().String(),
			"kind":       dashboardKind, // will trigger creating a URL
			"metadata": map[string]interface{}{
				"name": "the-uid",
			},
			"spec": map[string]interface{}{
				"title": "hello world", // has spaces
			},
		},
	}
	meta, _ := utils.MetaAccessor(obj)

	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
	reader.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "x",
		},
		Spec: v0alpha1.RepositorySpec{
			GitHub: &v0alpha1.GitHubRepositoryConfig{
				GenerateDashboardPreviews: true,
			},
		},
	})
	parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
		Info: finfo,
		Repo: v0alpha1.ResourceRepositoryInfo{
			Namespace: "x",
			Name:      "y",
		},
		GVK: schema.GroupVersionKind{
			Kind: dashboardKind,
		},
		Obj:            obj,
		Existing:       obj,
		Meta:           meta,
		DryRunResponse: obj, // avoid hitting the client
	}, nil)

	pullRequest := v0alpha1.PullRequestJobOptions{
		Ref: "ref",
		PR:  123,
		URL: "http://github.com/pr/",
	}
	createdFileChange := repository.VersionedFileChange{
		Action: repository.FileActionCreated,
		Path:   "path/to/file.json",
		Ref:    "ref",
	}

	t.Run("with-screenshot", func(t *testing.T) {
		renderer := NewMockScreenshotRenderer(t)
		renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)
		renderer.On("RenderScreenshot", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(getDummyRenderedURL("x"), nil)
		changes := []repository.VersionedFileChange{createdFileChange}

		parserFactory := resources.NewMockParserFactory(t)
		parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
		evaluator := NewEvaluator(renderer, parserFactory, func(_ string) string {
			return "http://host/"
		})

		info, err := evaluator.Evaluate(context.Background(), reader, pullRequest, changes, progress)
		require.NoError(t, err)

		require.False(t, info.MissingImageRenderer)
		require.Equal(t, map[string]string{
			"Grafana":         "http://host/d/the-uid/hello-world",
			"GrafanaSnapshot": "https://cdn2.thecatapi.com/images/9e2.jpg",
			"Preview":         "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
			"PreviewSnapshot": "https://cdn2.thecatapi.com/images/9e2.jpg",
		}, map[string]string{
			"Grafana":         info.Changes[0].GrafanaURL,
			"GrafanaSnapshot": info.Changes[0].GrafanaScreenshotURL,
			"Preview":         info.Changes[0].PreviewURL,
			"PreviewSnapshot": info.Changes[0].PreviewScreenshotURL,
		})
	})

	t.Run("without-screenshot", func(t *testing.T) {
		renderer := NewMockScreenshotRenderer(t)
		renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
		changes := []repository.VersionedFileChange{createdFileChange}
		parserFactory := resources.NewMockParserFactory(t)
		parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
		evaluator := NewEvaluator(renderer, parserFactory, func(_ string) string {
			return "http://host/"
		})

		info, err := evaluator.Evaluate(context.Background(), reader, pullRequest, changes, progress)
		require.NoError(t, err)

		require.True(t, info.MissingImageRenderer)
		require.Equal(t, map[string]string{
			"Grafana":         "http://host/d/the-uid/hello-world",
			"GrafanaSnapshot": "",
			"Preview":         "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
			"PreviewSnapshot": "",
		}, map[string]string{
			"Grafana":         info.Changes[0].GrafanaURL,
			"GrafanaSnapshot": info.Changes[0].GrafanaScreenshotURL,
			"Preview":         info.Changes[0].PreviewURL,
			"PreviewSnapshot": info.Changes[0].PreviewScreenshotURL,
		})
	})

	t.Run("process first 10 files", func(t *testing.T) {
		renderer := NewMockScreenshotRenderer(t)
		renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)

		changes := []repository.VersionedFileChange{}
		for range 15 {
			changes = append(changes, createdFileChange)
		}

		parserFactory := resources.NewMockParserFactory(t)
		parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
		evaluator := NewEvaluator(renderer, parserFactory, func(_ string) string {
			return "http://host/"
		})

		info, err := evaluator.Evaluate(context.Background(), reader, pullRequest, changes, progress)
		require.NoError(t, err)

		require.False(t, info.MissingImageRenderer)
		require.Equal(t, 10, len(info.Changes))
		require.Equal(t, 5, info.SkippedFiles)

		// Make sure we linked a URL, but no screenshot for each item
		for _, change := range info.Changes {
			require.NotEmpty(t, change.GrafanaURL)
			require.Empty(t, change.GrafanaScreenshotURL)
		}
	})
}

func TestDummyImageURL(t *testing.T) {
	urls := []string{}
	for i := range 10 {
		urls = append(urls, getDummyRenderedURL(fmt.Sprintf("http://%d", i)))
	}
	require.Equal(t, []string{
		"https://cdn2.thecatapi.com/images/9e2.jpg",
		"https://cdn2.thecatapi.com/images/bhs.jpg",
		"https://cdn2.thecatapi.com/images/d54.jpg",
		"https://cdn2.thecatapi.com/images/99c.jpg",
		"https://cdn2.thecatapi.com/images/9e2.jpg",
		"https://cdn2.thecatapi.com/images/bhs.jpg",
		"https://cdn2.thecatapi.com/images/d54.jpg",
		"https://cdn2.thecatapi.com/images/99c.jpg",
		"https://cdn2.thecatapi.com/images/9e2.jpg",
		"https://cdn2.thecatapi.com/images/bhs.jpg",
	}, urls)
}

// Returns a random (but stable) image for a string
func getDummyRenderedURL(url string) string {
	dummy := []string{
		"https://cdn2.thecatapi.com/images/9e2.jpg",
		"https://cdn2.thecatapi.com/images/bhs.jpg",
		"https://cdn2.thecatapi.com/images/d54.jpg",
		"https://cdn2.thecatapi.com/images/99c.jpg",
	}

	idx := 0
	hash := sha256.New()
	bytes := hash.Sum([]byte(url))
	if len(bytes) > 8 {
		v := binary.BigEndian.Uint64(bytes[0:8])
		idx = int(v) % len(dummy)
	}
	return dummy[idx]
}
