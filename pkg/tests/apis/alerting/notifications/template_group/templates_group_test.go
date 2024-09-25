package templateGroup

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingApiServer,
		},
	})
}

func TestIntegrationResourceIdentifier(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	client := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	newTemplate := &v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "templateGroup",
			Content: `{{ define "test" }} test {{ end }}`,
		},
	}

	t.Run("create should fail if object name is specified", func(t *testing.T) {
		template := newTemplate.DeepCopy()
		template.Name = "new-templateGroup"
		_, err := client.Create(ctx, template, v1.CreateOptions{})
		assert.Error(t, err)
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	var resourceID string
	t.Run("create should succeed and provide resource name", func(t *testing.T) {
		actual, err := client.Create(ctx, newTemplate, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.NotEmptyf(t, actual.UID, "Resource UID should not be empty")
		resourceID = actual.Name
	})

	var existingTemplateGroup *v0alpha1.TemplateGroup
	t.Run("resource should be available by the identifier", func(t *testing.T) {
		actual, err := client.Get(ctx, resourceID, v1.GetOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.Equal(t, newTemplate.Spec, actual.Spec)
		existingTemplateGroup = actual
	})

	t.Run("update should rename template if name in the specification changes", func(t *testing.T) {
		if existingTemplateGroup == nil {
			t.Skip()
		}
		updated := existingTemplateGroup.DeepCopy()
		updated.Spec.Title = "another-templateGroup"
		actual, err := client.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updated.Spec, actual.Spec)
		require.NotEqualf(t, updated.Name, actual.Name, "Update should change the resource name but it didn't")

		resource, err := client.Get(ctx, actual.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, actual, resource)
	})
}

func TestIntegrationAccessControl(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
		canCreate bool
		canDelete bool
	}

	reader := helper.CreateUser("TemplatesReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTemplatesRead,
			},
		},
	})
	writer := helper.CreateUser("TemplatesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTemplatesRead,
				accesscontrol.ActionAlertingNotificationsTemplatesWrite,
			},
		},
	})

	deleter := helper.CreateUser("TemplatesDeleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTemplatesRead,
				accesscontrol.ActionAlertingNotificationsTemplatesDelete,
			},
		},
	})

	testCases := []testCase{
		{
			user:      org1.Admin,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:      org1.Editor,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:    org1.Viewer,
			canRead: true,
		},
		{
			user:    reader,
			canRead: true,
		},
		{
			user:      writer,
			canRead:   true,
			canCreate: true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
	}

	admin := org1.Admin
	adminK8sClient, err := versioned.NewForConfig(admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			k8sClient, err := versioned.NewForConfig(tc.user.NewRestConfig())
			require.NoError(t, err)
			client := k8sClient.NotificationsV0alpha1().TemplateGroups("default")

			var expected = &v0alpha1.TemplateGroup{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.TemplateGroupSpec{
					Title:   fmt.Sprintf("template-group-1-%s", tc.user.Identity.GetLogin()),
					Content: `{{ define "test" }} test {{ end }}`,
				},
			}
			expected.SetProvenanceStatus("")
			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canCreate {
				t.Run("should be able to create template group", func(t *testing.T) {
					actual, err := client.Create(ctx, expected, v1.CreateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))
					require.Equal(t, expected.Spec, actual.Spec)

					t.Run("should fail if already exists", func(t *testing.T) {
						_, err := client.Create(ctx, actual, v1.CreateOptions{})
						require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
					})

					expected = actual
				})
			} else {
				t.Run("should be forbidden to create", func(t *testing.T) {
					_, err := client.Create(ctx, expected, v1.CreateOptions{})
					require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
				})

				// create resource to proceed with other tests
				expected, err = adminClient.Create(ctx, expected, v1.CreateOptions{})
				require.NoErrorf(t, err, "Payload %s", string(d))
				require.NotNil(t, expected)
			}

			if tc.canRead {
				t.Run("should be able to list template groups", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})

				t.Run("should be able to read template group by resource identifier", func(t *testing.T) {
					got, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.Equal(t, expected, got)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to list template groups", func(t *testing.T) {
					_, err := client.List(ctx, v1.ListOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})

				t.Run("should be forbidden to read template group by name", func(t *testing.T) {
					_, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			updatedExpected := expected.DeepCopy()
			updatedExpected.Spec.Content = `{{ define "another-test" }} test {{ end }}`

			d, err = json.Marshal(updatedExpected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update template group", func(t *testing.T) {
					updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update template group", func(t *testing.T) {
					_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			deleteOptions := v1.DeleteOptions{Preconditions: &v1.Preconditions{ResourceVersion: util.Pointer(expected.ResourceVersion)}}

			if tc.canDelete {
				t.Run("should be able to delete template group", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to delete template group", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.Name, v1.DeleteOptions{}))
			}

			if tc.canRead {
				t.Run("should get empty list if no mute timings", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 0)
				})
			}
		})
	}
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminK8sClient, err := versioned.NewForConfig(admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles, zanzana.NewNoopClient())
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac)
	require.NoError(t, err)

	created, err := adminClient.Create(ctx, &v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "template-group-1",
			Content: `{{ define "test" }} test {{ end }}`,
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "none", created.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.NotificationTemplate{
			Name: created.Spec.Title,
		}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})
	t.Run("should not let update if provisioned", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.Spec.Content = `{{ define "another-test" }} test {{ end }}`

		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	template := v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "template-group-1",
			Content: `{{ define "test" }} test {{ end }}`,
		},
	}

	created, err := adminClient.Create(ctx, &template, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotEmpty(t, created.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.ResourceVersion = "test"
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.Spec.Content = `{{ define "test-another" }} test {{ end }}`
		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should update if version is empty", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.ResourceVersion = ""
		updated.Spec.Content = `{{ define "test-another-2" }} test {{ end }}`

		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, created.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should fail to delete if version does not match", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer("something"),
			},
		})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should succeed if version matches", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
	t.Run("should succeed if version is empty", func(t *testing.T) {
		actual, err := adminClient.Create(ctx, &template, v1.CreateOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
}

func TestIntegrationPatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	template := v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "template-group",
			Content: `{{ define "test" }} test {{ end }}`,
		},
	}

	current, err := adminClient.Create(ctx, &template, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, current)
	require.NotEmpty(t, current.ResourceVersion)

	t.Run("should patch with merge patch", func(t *testing.T) {
		patch := `{
             "spec": {
                 "content" : "{{ define \"test-another\" }} test {{ end }}"
             }
		 }`

		result, err := adminClient.Patch(ctx, current.Name, types.MergePatchType, []byte(patch), v1.PatchOptions{})
		require.NoError(t, err)
		require.Equal(t, `{{ define "test-another" }} test {{ end }}`, result.Spec.Content)
		current = result
	})

	t.Run("should patch with json patch", func(t *testing.T) {
		expected := `{{ define "test-json-patch" }} test {{ end }}`

		patch := []map[string]interface{}{
			{
				"op":    "replace",
				"path":  "/spec/content",
				"value": expected,
			},
		}

		patchData, err := json.Marshal(patch)
		require.NoError(t, err)

		result, err := adminClient.Patch(ctx, current.Name, types.JSONPatchType, patchData, v1.PatchOptions{})
		require.NoError(t, err)
		expectedSpec := *current.Spec.DeepCopy()
		expectedSpec.Content = expected
		require.EqualValues(t, expectedSpec, result.Spec)
		current = result
	})
}

func TestIntegrationListSelector(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TemplateGroups("default")

	template1 := &v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "test1",
			Content: `{{ define "test1" }} test {{ end }}`,
		},
	}
	template1, err = adminClient.Create(ctx, template1, v1.CreateOptions{})
	require.NoError(t, err)

	template2 := &v0alpha1.TemplateGroup{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TemplateGroupSpec{
			Title:   "test2",
			Content: `{{ define "test2" }} test {{ end }}`,
		},
	}
	template2, err = adminClient.Create(ctx, template2, v1.CreateOptions{})
	require.NoError(t, err)
	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles, zanzana.NewNoopClient())
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac)
	require.NoError(t, err)
	require.NoError(t, db.SetProvenance(ctx, &definitions.NotificationTemplate{
		Name: template2.Spec.Title,
	}, helper.Org1.Admin.Identity.GetOrgID(), "API"))
	template2, err = adminClient.Get(ctx, template2.Name, v1.GetOptions{})

	require.NoError(t, err)

	templates, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, templates.Items, 2)

	t.Run("should filter by template name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "spec.title=" + template1.Spec.Title,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, template1.Name, list.Items[0].Name)
	})

	t.Run("should filter by template metadata name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "metadata.name=" + template2.Name,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, template2.Name, list.Items[0].Name)
	})

	t.Run("should filter by multiple filters", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s,metadata.provenance=%s", template2.Name, "API"),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, template2.Name, list.Items[0].Name)
	})

	t.Run("should be empty when filter does not match", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s,metadata.provenance=%s", template2.Name, "unknown"),
		})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})
}
