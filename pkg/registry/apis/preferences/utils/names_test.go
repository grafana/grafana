package utils_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	utils1 "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

func TestLegacyAuthorizer(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		output utils.OwnerReference
		found  bool
		obj    runtime.Object
		err    string
	}{{
		name:   "invalid",
		input:  "xxx-yyy",
		output: utils.OwnerReference{},
		found:  false,
	}, {
		name:   "with user",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{
				OwnerReferences: []v1.OwnerReference{{
					APIVersion: "iam.grafana.app/v0alpha1",
					Kind:       "User",
					Name:       "a",
				}},
			},
		},
	}, {
		name:   "missing user",
		input:  "user-",
		output: utils.OwnerReference{},
		found:  false,
	}, {
		name:   "with team",
		input:  "team-b",
		output: utils.OwnerReference{Owner: utils.TeamResourceOwner, Identifier: "b"},
		found:  true,
	}, {
		name:   "missing team",
		input:  "team-",
		output: utils.OwnerReference{},
		found:  false,
	}, {
		name:   "for namespace",
		input:  "namespace",
		output: utils.OwnerReference{Owner: utils.NamespaceResourceOwner},
		found:  true,
	}, {
		name:   "missing reference",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		err:    "missing owner reference",
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{},
		},
	}, {
		name:   "names mismatch",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		err:    "owner reference must match the same name",
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{
				OwnerReferences: []v1.OwnerReference{{
					APIVersion: "iam.grafana.app/v0alpha1",
					Kind:       "User",
					Name:       "not-same-name",
				}},
			},
		},
	}, {
		name:   "kinds mismatch",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		err:    "owner reference kind must match the name",
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{
				OwnerReferences: []v1.OwnerReference{{
					APIVersion: "iam.grafana.app/v0alpha1",
					Kind:       "NotUserKind",
					Name:       "a",
				}},
			},
		},
	}, {
		name:   "not iam",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		err:    "owner reference should be iam.grafana.app",
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{
				OwnerReferences: []v1.OwnerReference{{
					APIVersion: "something",
					Kind:       "User",
					Name:       "a",
				}},
			},
		},
	}, {
		name:   "multiple reference",
		input:  "user-a",
		output: utils.OwnerReference{Owner: utils.UserResourceOwner, Identifier: "a"},
		found:  true,
		err:    "multiple owner references",
		obj: &preferences.Stars{
			ObjectMeta: v1.ObjectMeta{
				OwnerReferences: []v1.OwnerReference{{
					APIVersion: "iam.grafana.app/v0alpha1",
					Kind:       "User",
					Name:       "a",
				}, {
					APIVersion: "iam.grafana.app/v0alpha1",
					Kind:       "User",
					Name:       "b",
				}},
			},
		},
	}}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output, found := utils.ParseOwnerFromName(tt.input)
			require.Equal(t, tt.output, output)
			require.Equal(t, tt.found, found)
			if tt.found {
				require.Equal(t, tt.input, output.AsName())
			}

			if tt.obj != nil {
				obj, err := utils1.MetaAccessor(tt.obj)
				require.NoError(t, err)
				err = output.Validate(obj)
				if tt.err == "" {
					require.NoError(t, err)
				} else {
					require.ErrorContains(t, err, tt.err)
				}
			}
		})
	}
}
