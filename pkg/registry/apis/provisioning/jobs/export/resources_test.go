package export

import (
	"context"
	"fmt"
	"testing"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"
)

func TestExportResources(t *testing.T) {
	tests := []struct {
		name           string
		reactorFunc    func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind)
	}{
		{
			name: "successful dashboard export",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				// Return dashboard list
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-2",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("dashboard-1.json", nil)

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
		},
		{
			name: "client error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("shouldn't happen")
			},
			expectedError: "get client for dashboards: didn't work",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, fmt.Errorf("didn't work"))
			},
		},
		{
			name: "dashboard list error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("failed to list dashboards")
			},
			expectedError: "export dashboards: error executing list: failed to list dashboards",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
		},
		{
			name: "dashboard export with errors",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-2",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
		},
		{
			name: "dashboard export too many errors",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
					},
				}, nil
			},
			expectedError: "export dashboards: too many errors encountered",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))
			},
		},
		{
			name: "ignores existing dashboards",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "existing-dashboard",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				// Return true to indicate the file already exists, and provide the updated path
				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "existing-dashboard"
				}), options).Return("", resources.ErrAlreadyInRepository)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := runtime.NewScheme()
			require.NoError(t, metav1.AddMetaToScheme(scheme))
			listGVK := schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    "DashboardList",
			}

			scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    resources.DashboardResource.Resource,
			}, &metav1.PartialObjectMetadata{})

			fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
				resources.DashboardResource: listGVK.Kind,
			})

			resourceClients := resources.NewMockResourceClients(t)
			fakeDynamicClient.PrependReactor("list", "dashboards", tt.reactorFunc)

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources, resourceClients, fakeDynamicClient, listGVK)

			options := v0alpha1.ExportJobOptions{
				Path:   "grafana",
				Branch: "feature/branch",
			}

			err := ExportResources(context.Background(), options, resourceClients, repoResources, mockProgress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockProgress.AssertExpectations(t)
			repoResources.AssertExpectations(t)
			resourceClients.AssertExpectations(t)
		})
	}
}
