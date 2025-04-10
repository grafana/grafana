package pullrequest

import (
	"context"
	"crypto/sha1"
	"encoding/binary"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestCalculateChanges(t *testing.T) {
	logger := &logging.NoOpLogger{}
	renderer := NewMockScreenshotRenderer(t)
	parser := resources.NewMockParser(t)
	reader := repository.NewMockReader(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	generator := NewCommentGenerator(renderer, func(namespace string) string {
		return "http://" + namespace + "/"
	})

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
				"name": "id",
			},
			"spec": map[string]interface{}{
				"title": "hello",
			},
		},
	}
	meta, _ := utils.MetaAccessor(obj)

	reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
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
		Meta:           meta,
		DryRunResponse: obj, // avoid hitting the client
	}, nil)

	info, err := generator.calculateChangeInfo(context.Background(), logger, "http://host/", repository.VersionedFileChange{
		Action: repository.FileActionCreated,
		Path:   "path/to/file.json",
		Ref:    "ref",
	}, ChangeOptions{
		PullRequest: v0alpha1.PullRequestJobOptions{
			Ref: "ref",
			PR:  123,
			URL: "http://github.com/pr/",
		},
		Parser:          parser,
		Reader:          reader,
		Progress:        progress,
		GeneratePreview: true,
	})
	require.NoError(t, err)

	// jj, err := json.MarshalIndent(info, "", "  ")
	// require.NoError(t, err)
	// fmt.Printf("%s", string(jj))

	require.Equal(t, `http://host/d/id/hello`, info.GrafanaURL)
	require.Equal(t, `http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref`, info.PreviewURL)
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
	hash := sha1.New()
	bytes := hash.Sum([]byte(url))
	if len(bytes) > 8 {
		v := binary.BigEndian.Uint64(bytes[0:8])
		idx = int(v) % len(dummy)
	}
	return dummy[idx]
}
