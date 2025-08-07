package pullrequest

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestCalculateChanges(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory)
		changes        []repository.VersionedFileChange
		expectedInfo   changeInfo
		expectedError  string
		grafanaBaseURL string
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
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					GrafanaURL:           "http://host/d/the-uid/hello-world",
					PreviewURL:           "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
					GrafanaScreenshotURL: "https://cdn2.thecatapi.com/images/9e2.jpg",
					PreviewScreenshotURL: "https://cdn2.thecatapi.com/images/9e2.jpg",
				}},
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
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					GrafanaURL:           "http://host/d/the-uid/hello-world",
					PreviewURL:           "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
					GrafanaScreenshotURL: "",
					PreviewScreenshotURL: "",
				}},
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
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
				Changes: func() []fileChangeInfo {
					changes := []fileChangeInfo{}
					for range 10 {
						changes = append(changes, fileChangeInfo{
							Change: repository.VersionedFileChange{
								Action: repository.FileActionCreated,
								Path:   "path/to/file.json",
								Ref:    "ref",
							},
							GrafanaURL: "http://host/d/the-uid/hello-world",
							PreviewURL: "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
						})
					}
					return changes
				}(),
			},
		},
		{
			name: "parser factory error",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("parser factory error"))
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedError: "failed to get parser for test-repo: parser factory error",
		},
		{
			name: "file read error",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(nil, fmt.Errorf("read error"))
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error: "read error",
				}},
			},
		},
		{
			name: "parse error",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()

				finfo := &repository.FileInfo{
					Path: "path/to/file.json",
					Ref:  "ref",
					Data: []byte("invalid json"),
				}
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				parser.On("Parse", mock.Anything, finfo).Return(nil, fmt.Errorf("parse error"))
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error: "parse error",
				}},
			},
		},
		{
			name: "dry run error",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)

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

				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				parsed := &resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
						Namespace: "x",
						Name:      "y",
					},
					GVK: schema.GroupVersionKind{
						Kind: dashboardKind,
					},
					Obj:      obj,
					Existing: obj,
					Meta:     meta,
				}
				parser.On("Parse", mock.Anything, finfo).Return(parsed, nil)
				parsed.DryRunResponse = nil // This will cause a dry run error
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error: "no client configured",
					Title: "hello world",
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "path/to/file.json",
							Ref:  "ref",
							Data: []byte("xxxx"),
						},
						GVK: schema.GroupVersionKind{
							Kind: dashboardKind,
						},
					},
				}},
			},
		},
		{
			name: "screenshot render error",
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

				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
					Return("", fmt.Errorf("render error"))
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				MissingImageRenderer: true,
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error:      "error rendering screenshot: render error",
					GrafanaURL: "http://host/d/the-uid/hello-world",
					PreviewURL: "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
				}},
			},
		},
		{
			name: "non-dashboard resource",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				finfo := &repository.FileInfo{
					Path: "path/to/file.json",
					Ref:  "ref",
					Data: []byte("xxxx"),
				}
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": "test/v1",
						"kind":       "TestResource",
						"metadata": map[string]interface{}{
							"name": "test-resource",
						},
						"spec": map[string]interface{}{
							"title": "Test Resource",
						},
					},
				}
				meta, _ := utils.MetaAccessor(obj)
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
						Namespace: "x",
						Name:      "y",
					},
					GVK: schema.GroupVersionKind{
						Kind: "TestResource",
					},
					Obj:            obj,
					Existing:       obj,
					Meta:           meta,
					DryRunResponse: obj,
				}, nil)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Title: "Test Resource",
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "path/to/file.json",
							Ref:  "ref",
							Data: []byte("xxxx"),
						},
						GVK: schema.GroupVersionKind{
							Kind: "TestResource",
						},
					},
				}},
			},
		},
		{
			name: "deleted file",
			setupMocks: func(parser *resources.MockParser, reader *repository.MockReader, progress *jobs.MockJobProgressRecorder, renderer *MockScreenshotRenderer, parserFactory *resources.MockParserFactory) {
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
				})
				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionDeleted,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionDeleted,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error: "delete feedback not yet implemented",
				}},
			},
		},
		{
			name: "invalid grafana url",
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
							"name": "the:uid", // Invalid character in UID
						},
						"spec": map[string]interface{}{
							"title": "hello world",
						},
					},
				}
				meta, _ := utils.MetaAccessor(obj)

				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(true)
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "x" && repo.Name == "y"
				}), "d/the:uid/hello-world", mock.Anything).Return("", fmt.Errorf("invalid URL"))
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "x" && repo.Name == "y"
				}), "admin/provisioning/y/dashboard/preview/path/to/file.json", mock.Anything).Return("", fmt.Errorf("invalid preview URL"))

				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parser.On("Parse", mock.Anything, finfo).Return(&resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				MissingImageRenderer: true,
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					Error:      "error rendering screenshot: invalid preview URL",
					GrafanaURL: "http://host/d/the:uid/hello-world", // Invalid URL
					PreviewURL: "http://host/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
				}},
			},
		},
		{
			name:           "malformed grafana url",
			grafanaBaseURL: "ht tp://bad url/",
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

				renderer.On("IsAvailable", mock.Anything, mock.Anything).Return(false)
				progress.On("SetMessage", mock.Anything, "process path/to/file.json").Return()
				reader.On("Read", mock.Anything, "path/to/file.json", "ref").Return(finfo, nil)
				reader.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "x",
					},
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							GenerateDashboardPreviews: true,
						},
					},
				})
				parsed := &resources.ParsedResource{
					Info: finfo,
					Repo: provisioning.ResourceRepositoryInfo{
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
				}
				parser.On("Parse", mock.Anything, finfo).Return(parsed, nil)
				parserFactory.On("GetParser", mock.Anything, mock.Anything).Return(parser, nil)
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated,
				Path:   "path/to/file.json",
				Ref:    "ref",
			}},
			expectedInfo: changeInfo{
				MissingImageRenderer: true,
				Changes: []fileChangeInfo{{
					Change: repository.VersionedFileChange{
						Action: repository.FileActionCreated,
						Path:   "path/to/file.json",
						Ref:    "ref",
					},
					GrafanaURL: "ht tp://bad url/d/the-uid/hello-world", // Malformed URL
					PreviewURL: "ht tp://bad url/admin/provisioning/y/dashboard/preview/path/to/file.json?pull_request_url=http%253A%252F%252Fgithub.com%252Fpr%252F&ref=ref",
				}},
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
				if tt.grafanaBaseURL != "" {
					return tt.grafanaBaseURL
				}

				return "http://host/"
			})

			pullRequest := provisioning.PullRequestJobOptions{
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
			require.Equal(t, len(tt.expectedInfo.Changes), len(info.Changes))
			require.Equal(t, tt.expectedInfo.SkippedFiles, info.SkippedFiles)

			// compare change URLs
			for i, change := range info.Changes {
				require.Equal(t, tt.expectedInfo.Changes[i].GrafanaURL, change.GrafanaURL)
				require.Equal(t, tt.expectedInfo.Changes[i].PreviewURL, change.PreviewURL)
				require.Equal(t, tt.expectedInfo.Changes[i].GrafanaScreenshotURL, change.GrafanaScreenshotURL)
				require.Equal(t, tt.expectedInfo.Changes[i].PreviewScreenshotURL, change.PreviewScreenshotURL)
				require.Equal(t, tt.expectedInfo.Changes[i].Error, change.Error)
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

// FIXME: test these cases from the public interface once the component is refactored
func TestRenderScreenshotFromGrafanaURL(t *testing.T) {
	tests := []struct {
		name       string
		baseURL    string
		grafanaURL string
		setupMock  func(renderer *MockScreenshotRenderer)
		wantSnap   string
		wantErr    string
	}{
		{
			name:       "invalid grafana url",
			baseURL:    "http://host/",
			grafanaURL: "ht tp://host/d/uid/dashboard",
			setupMock:  func(renderer *MockScreenshotRenderer) {},
			wantErr:    `parse "ht tp://host/d/uid/dashboard": first path segment in URL cannot contain colon`,
		},
		{
			name:       "invalid base url",
			baseURL:    "ht tp://bad host/",
			grafanaURL: "http://host/d/uid/dashboard",
			setupMock: func(renderer *MockScreenshotRenderer) {
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "test" && repo.Name == "repo"
				}), "d/uid/dashboard", mock.Anything).Return("screenshot.png", nil)
			},
			wantErr: `parse "ht tp://bad host/": first path segment in URL cannot contain colon`,
		},
		{
			name:       "render error",
			baseURL:    "http://host/",
			grafanaURL: "http://host/d/uid/dashboard",
			setupMock: func(renderer *MockScreenshotRenderer) {
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "test" && repo.Name == "repo"
				}), "d/uid/dashboard", mock.Anything).Return("", fmt.Errorf("render failed"))
			},
			wantErr: "error rendering screenshot: render failed",
		},
		{
			name:       "cdn url returned",
			baseURL:    "http://host/",
			grafanaURL: "http://host/d/uid/dashboard",
			setupMock: func(renderer *MockScreenshotRenderer) {
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "test" && repo.Name == "repo"
				}), "d/uid/dashboard", mock.Anything).Return("https://cdn.example.com/screenshot.png", nil)
			},
			wantSnap: "https://cdn.example.com/screenshot.png",
		},
		{
			name:       "successful render with relative path",
			baseURL:    "http://host/",
			grafanaURL: "http://host/d/uid/dashboard",
			setupMock: func(renderer *MockScreenshotRenderer) {
				renderer.On("RenderScreenshot", mock.Anything, mock.MatchedBy(func(repo provisioning.ResourceRepositoryInfo) bool {
					return repo.Namespace == "test" && repo.Name == "repo"
				}), "d/uid/dashboard", mock.Anything).Return("screenshots/123.png", nil)
			},
			wantSnap: "http://host/screenshots/123.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			renderer := NewMockScreenshotRenderer(t)
			tt.setupMock(renderer)

			repo := provisioning.ResourceRepositoryInfo{
				Namespace: "test",
				Name:      "repo",
			}

			got, err := renderScreenshotFromGrafanaURL(context.Background(), tt.baseURL, renderer, repo, tt.grafanaURL)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErr)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantSnap, got)
		})
	}
}
