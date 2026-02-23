package reconciler

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"

	"github.com/openfga/openfga/pkg/typesystem"
)

// toUnstructured converts a typed Kubernetes object to an unstructured object for use in translator tests.
func toUnstructured(t *testing.T, obj any) *unstructured.Unstructured {
	t.Helper()
	raw, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(t, err)
	return &unstructured.Unstructured{Object: raw}
}

// ---------------------------------------------------------------------------
// Unit tests: verify that each translator produces the expected tuple fields.
// ---------------------------------------------------------------------------

func TestTranslateResourcePermissionToTuples(t *testing.T) {
	tests := []struct {
		name             string
		permKind         iamv0.ResourcePermissionSpecPermissionKind
		permName         string
		verb             string
		expectedUser     string
		expectedRelation string
		expectedObject   string
	}{
		{
			name:             "user permission",
			permKind:         iamv0.ResourcePermissionSpecPermissionKindUser,
			permName:         "uid1",
			verb:             "view",
			expectedUser:     "user:uid1",
			expectedRelation: "view",
			expectedObject:   "resource:dashboard.grafana.app/dashboards/dash1",
		},
		{
			name:             "service-account permission",
			permKind:         iamv0.ResourcePermissionSpecPermissionKindServiceAccount,
			permName:         "sa1",
			verb:             "edit",
			expectedUser:     "service-account:sa1",
			expectedRelation: "edit",
			expectedObject:   "resource:dashboard.grafana.app/dashboards/dash1",
		},
		{
			name:             "team permission",
			permKind:         iamv0.ResourcePermissionSpecPermissionKindTeam,
			permName:         "team1",
			verb:             "view",
			expectedUser:     "team:team1#member",
			expectedRelation: "view",
			expectedObject:   "resource:dashboard.grafana.app/dashboards/dash1",
		},
		{
			name:             "basic role permission",
			permKind:         iamv0.ResourcePermissionSpecPermissionKindBasicRole,
			permName:         "Editor",
			verb:             "admin",
			expectedUser:     "role:basic_editor#assignee",
			expectedRelation: "admin",
			expectedObject:   "resource:dashboard.grafana.app/dashboards/dash1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rp := &iamv0.ResourcePermission{
				ObjectMeta: metav1.ObjectMeta{Name: "rp-test"},
				Spec: iamv0.ResourcePermissionSpec{
					Resource: iamv0.ResourcePermissionspecResource{
						ApiGroup: "dashboard.grafana.app",
						Resource: "dashboards",
						Name:     "dash1",
					},
					Permissions: []iamv0.ResourcePermissionspecPermission{
						{
							Kind: tt.permKind,
							Name: tt.permName,
							Verb: tt.verb,
						},
					},
				},
			}

			tuples, err := TranslateResourcePermissionToTuples(toUnstructured(t, rp))
			require.NoError(t, err)
			require.Len(t, tuples, 1)

			assert.Equal(t, tt.expectedUser, tuples[0].GetUser())
			assert.Equal(t, tt.expectedRelation, tuples[0].GetRelation())
			assert.Equal(t, tt.expectedObject, tuples[0].GetObject())
		})
	}
}

func TestTranslateTeamBindingToTuples(t *testing.T) {
	tests := []struct {
		name             string
		permission       iamv0.TeamBindingTeamPermission
		expectedRelation string
	}{
		{
			name:             "member binding",
			permission:       iamv0.TeamBindingTeamPermissionMember,
			expectedRelation: common.RelationTeamMember,
		},
		{
			name:             "admin binding",
			permission:       iamv0.TeamBindingTeamPermissionAdmin,
			expectedRelation: common.RelationTeamAdmin,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tb := &iamv0.TeamBinding{
				ObjectMeta: metav1.ObjectMeta{Name: "tb-test"},
				Spec: iamv0.TeamBindingSpec{
					Subject:    iamv0.TeamBindingspecSubject{Name: "user1"},
					TeamRef:    iamv0.TeamBindingTeamRef{Name: "teamA"},
					Permission: tt.permission,
				},
			}

			tuples, err := TranslateTeamBindingToTuples(toUnstructured(t, tb))
			require.NoError(t, err)
			require.Len(t, tuples, 1)

			assert.Equal(t, "user:user1", tuples[0].GetUser())
			assert.Equal(t, tt.expectedRelation, tuples[0].GetRelation())
			assert.Equal(t, "team:teamA", tuples[0].GetObject())
		})
	}
}

func TestTranslateRoleBindingToTuples(t *testing.T) {
	tests := []struct {
		name         string
		subjectKind  iamv0.RoleBindingSpecSubjectKind
		subjectName  string
		expectedUser string
	}{
		{
			name:         "user subject",
			subjectKind:  iamv0.RoleBindingSpecSubjectKindUser,
			subjectName:  "uid1",
			expectedUser: "user:uid1",
		},
		{
			name:         "service-account subject",
			subjectKind:  iamv0.RoleBindingSpecSubjectKindServiceAccount,
			subjectName:  "sa1",
			expectedUser: "service-account:sa1",
		},
		{
			name:         "team subject",
			subjectKind:  iamv0.RoleBindingSpecSubjectKindTeam,
			subjectName:  "team1",
			expectedUser: "team:team1#member",
		},
		{
			name:         "basic role subject",
			subjectKind:  iamv0.RoleBindingSpecSubjectKindBasicRole,
			subjectName:  "basic_viewer",
			expectedUser: "role:basic_viewer#assignee",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rb := &iamv0.RoleBinding{
				ObjectMeta: metav1.ObjectMeta{Name: "rb-test"},
				Spec: iamv0.RoleBindingSpec{
					Subject: iamv0.RoleBindingspecSubject{
						Kind: tt.subjectKind,
						Name: tt.subjectName,
					},
					RoleRefs: []iamv0.RoleBindingspecRoleRef{
						{Kind: iamv0.RoleBindingSpecRoleRefKindRole, Name: "custom-role-1"},
					},
				},
			}

			tuples, err := TranslateRoleBindingToTuples(toUnstructured(t, rb))
			require.NoError(t, err)
			require.Len(t, tuples, 1)

			assert.Equal(t, tt.expectedUser, tuples[0].GetUser())
			assert.Equal(t, common.RelationAssignee, tuples[0].GetRelation())
			assert.Equal(t, "role:custom-role-1", tuples[0].GetObject())
		})
	}
}

func TestTranslateUserToTuples(t *testing.T) {
	tests := []struct {
		name           string
		role           string
		expectedTuples int
		expectedUser   string
		expectedObject string
	}{
		{
			name:           "viewer role",
			role:           "Viewer",
			expectedTuples: 1,
			expectedUser:   "user:user-test",
			expectedObject: "role:basic_viewer",
		},
		{
			name:           "editor role",
			role:           "Editor",
			expectedTuples: 1,
			expectedUser:   "user:user-test",
			expectedObject: "role:basic_editor",
		},
		{
			name:           "admin role",
			role:           "Admin",
			expectedTuples: 1,
			expectedUser:   "user:user-test",
			expectedObject: "role:basic_admin",
		},
		{
			name:           "empty role produces no tuples",
			role:           "",
			expectedTuples: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &iamv0.User{
				ObjectMeta: metav1.ObjectMeta{Name: "user-test"},
				Spec:       iamv0.UserSpec{Role: tt.role},
			}

			tuples, err := TranslateUserToTuples(toUnstructured(t, user))
			require.NoError(t, err)

			if tt.expectedTuples == 0 {
				assert.Nil(t, tuples)
				return
			}

			require.Len(t, tuples, tt.expectedTuples)
			assert.Equal(t, tt.expectedUser, tuples[0].GetUser())
			assert.Equal(t, common.RelationAssignee, tuples[0].GetRelation())
			assert.Equal(t, tt.expectedObject, tuples[0].GetObject())
		})
	}
}

func TestTranslateFolderToTuples(t *testing.T) {
	t.Run("folder with parent", func(t *testing.T) {
		folder := &folderv1.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "child-folder",
				Annotations: map[string]string{
					"grafana.app/folder": "parent-folder",
				},
			},
			Spec: folderv1.FolderSpec{Title: "Child"},
		}

		tuples, err := TranslateFolderToTuples(toUnstructured(t, folder))
		require.NoError(t, err)
		require.Len(t, tuples, 1)

		assert.Equal(t, "folder:child-folder", tuples[0].GetUser())
		assert.Equal(t, common.RelationParent, tuples[0].GetRelation())
		assert.Equal(t, "folder:parent-folder", tuples[0].GetObject())
	})

	t.Run("root folder without parent", func(t *testing.T) {
		folder := &folderv1.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "root-folder"},
			Spec:       folderv1.FolderSpec{Title: "Root"},
		}

		tuples, err := TranslateFolderToTuples(toUnstructured(t, folder))
		require.NoError(t, err)
		assert.Nil(t, tuples)
	})
}

// ---------------------------------------------------------------------------
// Schema validation: verify that translated tuples conform to the FGA model.
// ---------------------------------------------------------------------------

// loadTypesystem loads the Zanzana FGA schema modules and creates a TypeSystem
// that can be used to validate tuples against the authorization model.
func loadTypesystem(t *testing.T) *typesystem.TypeSystem {
	t.Helper()

	model, err := schema.TransformModulesToModel(schema.SchemaModules)
	require.NoError(t, err)

	ts, err := typesystem.NewAndValidate(context.Background(), model)
	require.NoError(t, err)

	return ts
}

// validateTupleAgainstSchema checks that the tuple's object type, relation,
// and user type are all valid according to the FGA schema. This catches
// issues like using "team:X" when only "team:X#member" is allowed.
func validateTupleAgainstSchema(t *testing.T, ts *typesystem.TypeSystem, tuple *openfgav1.TupleKey) {
	t.Helper()

	objectType, relation, user := parseTypeTuple(tuple)

	// Validate that the object type exists in the model.
	_, ok := ts.GetTypeDefinition(objectType)
	require.True(t, ok, "object type %q not found in schema", objectType)

	// Validate that the relation exists on the object type.
	rel, err := ts.GetRelation(objectType, relation)
	require.NoError(t, err, "relation %q not found on type %q", relation, objectType)

	// Get the allowed directly-related user types for this relation.
	allowedTypes := rel.GetTypeInfo().GetDirectlyRelatedUserTypes()
	require.NotEmpty(t, allowedTypes, "no directly related user types for %s#%s", objectType, relation)

	// Parse the user field to extract type and optional relation.
	userType, userRelation := parseUser(user)

	// Check if the user type (with optional relation) is in the allowed list.
	found := false
	for _, allowed := range allowedTypes {
		if allowed.GetType() == userType && allowed.GetRelation() == userRelation {
			found = true
			break
		}
	}

	require.True(t, found,
		"user %q (type=%q, relation=%q) is not an allowed type restriction for %s#%s",
		user, userType, userRelation, objectType, relation,
	)
}

// parseTypeTuple extracts the object type, relation, and user from a TupleKey.
func parseTypeTuple(tk *openfgav1.TupleKey) (objectType, relation, user string) {
	object := tk.GetObject()
	// Object format: "type:id" — extract the type prefix before ":"
	for i, c := range object {
		if c == ':' {
			objectType = object[:i]
			break
		}
	}
	return objectType, tk.GetRelation(), tk.GetUser()
}

// parseUser extracts the type and optional relation from a user string.
// Formats: "type:id" -> (type, ""), "type:id#relation" -> (type, relation).
func parseUser(user string) (userType, userRelation string) {
	// Split on '#' to get an optional relation.
	hashIdx := -1
	for i := len(user) - 1; i >= 0; i-- {
		if user[i] == '#' {
			hashIdx = i
			break
		}
	}

	objectPart := user
	if hashIdx >= 0 {
		objectPart = user[:hashIdx]
		userRelation = user[hashIdx+1:]
	}

	// Extract the type from "type:id".
	for i, c := range objectPart {
		if c == ':' {
			userType = objectPart[:i]
			return
		}
	}

	return objectPart, userRelation
}

func TestTranslatedTuplesAreSchemaValid(t *testing.T) {
	ts := loadTypesystem(t)

	t.Run("resource permissions for all subject kinds", func(t *testing.T) {
		kinds := []struct {
			kind iamv0.ResourcePermissionSpecPermissionKind
			name string
		}{
			{iamv0.ResourcePermissionSpecPermissionKindUser, "uid1"},
			{iamv0.ResourcePermissionSpecPermissionKindServiceAccount, "sa1"},
			{iamv0.ResourcePermissionSpecPermissionKindTeam, "team1"},
			{iamv0.ResourcePermissionSpecPermissionKindBasicRole, "Editor"},
		}

		for _, k := range kinds {
			t.Run(string(k.kind), func(t *testing.T) {
				rp := &iamv0.ResourcePermission{
					ObjectMeta: metav1.ObjectMeta{Name: "rp-schema-test"},
					Spec: iamv0.ResourcePermissionSpec{
						Resource: iamv0.ResourcePermissionspecResource{
							ApiGroup: "dashboard.grafana.app",
							Resource: "dashboards",
							Name:     "d1",
						},
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: k.kind, Name: k.name, Verb: "view"},
						},
					},
				}

				tuples, err := TranslateResourcePermissionToTuples(toUnstructured(t, rp))
				require.NoError(t, err)

				for _, tuple := range tuples {
					validateTupleAgainstSchema(t, ts, tuple)
				}
			})
		}
	})

	t.Run("team bindings", func(t *testing.T) {
		for _, perm := range []iamv0.TeamBindingTeamPermission{
			iamv0.TeamBindingTeamPermissionMember,
			iamv0.TeamBindingTeamPermissionAdmin,
		} {
			t.Run(string(perm), func(t *testing.T) {
				tb := &iamv0.TeamBinding{
					ObjectMeta: metav1.ObjectMeta{Name: "tb-schema-test"},
					Spec: iamv0.TeamBindingSpec{
						Subject:    iamv0.TeamBindingspecSubject{Name: "user1"},
						TeamRef:    iamv0.TeamBindingTeamRef{Name: "teamA"},
						Permission: perm,
					},
				}

				tuples, err := TranslateTeamBindingToTuples(toUnstructured(t, tb))
				require.NoError(t, err)

				for _, tuple := range tuples {
					validateTupleAgainstSchema(t, ts, tuple)
				}
			})
		}
	})

	t.Run("role bindings for all subject kinds", func(t *testing.T) {
		subjects := []struct {
			kind iamv0.RoleBindingSpecSubjectKind
			name string
		}{
			{iamv0.RoleBindingSpecSubjectKindUser, "uid1"},
			{iamv0.RoleBindingSpecSubjectKindServiceAccount, "sa1"},
			{iamv0.RoleBindingSpecSubjectKindTeam, "team1"},
			{iamv0.RoleBindingSpecSubjectKindBasicRole, "basic_viewer"},
		}

		for _, s := range subjects {
			t.Run(string(s.kind), func(t *testing.T) {
				rb := &iamv0.RoleBinding{
					ObjectMeta: metav1.ObjectMeta{Name: "rb-schema-test"},
					Spec: iamv0.RoleBindingSpec{
						Subject: iamv0.RoleBindingspecSubject{
							Kind: s.kind,
							Name: s.name,
						},
						RoleRefs: []iamv0.RoleBindingspecRoleRef{
							{Kind: iamv0.RoleBindingSpecRoleRefKindRole, Name: "custom-role"},
						},
					},
				}

				tuples, err := TranslateRoleBindingToTuples(toUnstructured(t, rb))
				require.NoError(t, err)

				for _, tuple := range tuples {
					validateTupleAgainstSchema(t, ts, tuple)
				}
			})
		}
	})

	t.Run("user basic role assignments", func(t *testing.T) {
		for _, role := range []string{"Viewer", "Editor", "Admin"} {
			t.Run(role, func(t *testing.T) {
				user := &iamv0.User{
					ObjectMeta: metav1.ObjectMeta{Name: "user-schema-test"},
					Spec:       iamv0.UserSpec{Role: role},
				}

				tuples, err := TranslateUserToTuples(toUnstructured(t, user))
				require.NoError(t, err)

				for _, tuple := range tuples {
					validateTupleAgainstSchema(t, ts, tuple)
				}
			})
		}
	})

	t.Run("folder parent relationship", func(t *testing.T) {
		folder := &folderv1.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "child",
				Annotations: map[string]string{
					"grafana.app/folder": "parent",
				},
			},
			Spec: folderv1.FolderSpec{Title: "Child"},
		}

		tuples, err := TranslateFolderToTuples(toUnstructured(t, folder))
		require.NoError(t, err)

		for _, tuple := range tuples {
			validateTupleAgainstSchema(t, ts, tuple)
		}
	})
}
