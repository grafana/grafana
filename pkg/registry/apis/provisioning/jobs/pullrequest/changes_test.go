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
	tests := []struct {
		name          string
		setupMocks    func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory)
		changes       []repository.VersionedFileChange
		expectedInfo  changeInfo
		expectedURLs  map[string]string
		expectedError string
	}{
		{
			name: "with screenshot",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				finfo := &repository.FileInfo{
					Path: "path/to/file.json",
					Ref:  "ref",
					Data: []byte("xxxx"),
				}
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       dashboardKind,
						"metadata": map[string]interface{}{
							"name": "the-uid",
						},
						"spec": map[string]interface{}{
							"title": "hello world",
						},
					},
				}
				meta, _ := utils.MetaAccessor(obj)

				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				progress.On("SetMessage", mock.Anything, "render screenshots path/to/file.json").Return()
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
					DryRunResponse: obj,
				}, nil)
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)
				renderer.On("RenderScreenshot", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(getDummyRenderedURL("x"), nil)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedURLs: map[string]string{
				"Grafana":         "http://host/d/the-uid/hello-world",
				"GrafanaSnapshot": "https://cdn2.thecatapi.com/images/9e2.jpg",
				"Preview":         "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
				"PreviewSnapshot": "https://cdn2.thecatapi.com/images/9e2.jpg",
			},
		},
		{
			name: "without screenshot",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				finfo := &repository.FileInfo{
					Path: "path/to/file.json",
					Ref:  "ref",
					Data: []byte("xxxx"),
				}
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       dashboardKind,
						"metadata": map[string]interface{}{
							"name": "the-uid",
						},
						"spec": map[string]interface{}{
							"title": "hello world",
						},
					},
				}
				meta, _ := utils.MetaAccessor(obj)

				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
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
					DryRunResponse: obj,
				}, nil)
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedURLs: map[string]string{
				"Grafana":         "http://host/d/the-uid/hello-world",
				"GrafanaSnapshot": "",
				"Preview":         "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
				"PreviewSnapshot": "",
			},
		},
		{
			name: "process first 10 files",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				finfo := &repository.FileInfo{
					Path: "path/to/file.json",
					Ref:  "ref",
					Data: []byte("xxxx"),
				}
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       dashboardKind,
						"metadata": map[string]interface{}{
							"name": "the-uid",
						},
						"spec": map[string]interface{}{
							"title": "hello world",
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
					DryRunResponse: obj,
				}, nil)
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: func() []repository.VersionedFileChange {
				changes := []repository.VersionedFileChange{}
				for range 15 {
					changes = append(changes, repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					})
				}
				return changes
			}(),
			expectedInfo: changeInfo{
				SkippedFiles: 5,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := resources.NewMockParser(t)
			reader := repository.NewMockReader(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			renderer := NewMockScreenshotRenderer(t)
			parserFactory := resources.NewMockParserFactory(t)

			tt.setupMocks(parser, reader, progress, renderer, parserFactory)

			evaluator := NewEvaluator(renderer, parserFactory, func(_ string) string {
				return "http://host/"
			})

			pullRequest := v0alpha1.PullRequestJobOptions{
				Ref: "ref",
				PR:  123,
				URL: "http://github.com/pr/",
			}

			info, err := evaluator.Evaluate(context.Background(), reader, pullRequest, tt.changes, progress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
				return
			}

			require.NoError(t, err)
			if tt.expectedURLs != nil {
				require.Equal(t, tt.expectedURLs, map[string]string{
					"Grafana":         info.Changes[0].GrafanaURL,
					"GrafanaSnapshot": info.Changes[0].GrafanaScreenshotURL,
					"Preview":         info.Changes[0].PreviewURL,
					"PreviewSnapshot": info.Changes[0].PreviewScreenshotURL,
				})
			}

			if tt.name == "process first 10 files" {
				require.Equal(t, 10, len(info.Changes))
				require.Equal(t, tt.expectedInfo.SkippedFiles, info.SkippedFiles)
				for _, change := range info.Changes {
					require.NotEmpty(t, change.GrafanaURL)
					require.Empty(t, change.GrafanaScreenshotURL)
				}
			}
		})
	}
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
