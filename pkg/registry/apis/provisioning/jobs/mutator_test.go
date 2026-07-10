package jobs

import (
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appjobs "github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestAdmissionMutator_Mutate(t *testing.T) {
	userRequester := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		Name:    "Test User",
		Email:   "test@example.com",
		UserUID: "abc123",
	}

	tests := []struct {
		name        string
		operation   admission.Operation
		requester   identity.Requester
		flag        bool
		annotations map[string]string
		expected    map[string]string
	}{
		{
			name:      "user with flag enabled sets author annotations",
			operation: admission.Create,
			requester: userRequester,
			flag:      true,
			expected: map[string]string{
				appjobs.AnnoAuthor:      "Test User",
				appjobs.AnnoAuthorEmail: "test@example.com",
				appjobs.AnnoAuthorID:    "user:abc123",
			},
		},
		{
			name:        "client-supplied annotations are overwritten by the requester",
			operation:   admission.Create,
			requester:   userRequester,
			flag:        true,
			annotations: map[string]string{appjobs.AnnoAuthor: "Spoofed", appjobs.AnnoAuthorEmail: "spoof@evil.com"},
			expected: map[string]string{
				appjobs.AnnoAuthor:      "Test User",
				appjobs.AnnoAuthorEmail: "test@example.com",
				appjobs.AnnoAuthorID:    "user:abc123",
			},
		},
		{
			name:        "flag disabled strips client-supplied annotations",
			operation:   admission.Create,
			requester:   userRequester,
			flag:        false,
			annotations: map[string]string{appjobs.AnnoAuthor: "Spoofed", appjobs.AnnoAuthorEmail: "spoof@evil.com"},
			expected:    map[string]string{},
		},
		{
			name:      "service identity strips client-supplied annotations",
			operation: admission.Create,
			requester: &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy,
				Name: "provisioning",
			},
			flag:        true,
			annotations: map[string]string{appjobs.AnnoAuthor: "Spoofed"},
			expected:    map[string]string{},
		},
		{
			name:        "non-create operation is left untouched",
			operation:   admission.Update,
			requester:   userRequester,
			flag:        true,
			annotations: map[string]string{appjobs.AnnoAuthor: "Existing"},
			expected:    map[string]string{appjobs.AnnoAuthor: "Existing"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}
			setUserAttributionFlag(t, tt.flag)

			job := &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Annotations: tt.annotations},
			}
			attrs := admission.NewAttributesRecord(
				job, nil,
				schema.GroupVersionKind{},
				"default", "test-job",
				provisioning.JobResourceInfo.GroupVersionResource(),
				"", tt.operation, nil, false, nil,
			)

			err := NewAdmissionMutator().Mutate(ctx, attrs, nil)
			require.NoError(t, err)

			// The mutator only ever touches the author annotations; assert on
			// exactly those to confirm none are left stray.
			got := map[string]string{}
			for _, k := range []string{appjobs.AnnoAuthor, appjobs.AnnoAuthorEmail, appjobs.AnnoAuthorID} {
				if v, ok := job.Annotations[k]; ok {
					got[k] = v
				}
			}
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestAdmissionMutator_Mutate_RejectsNonJob(t *testing.T) {
	attrs := admission.NewAttributesRecord(
		&provisioning.Repository{}, nil,
		schema.GroupVersionKind{},
		"default", "test",
		provisioning.JobResourceInfo.GroupVersionResource(),
		"", admission.Create, nil, false, nil,
	)
	err := NewAdmissionMutator().Mutate(t.Context(), attrs, nil)
	require.Error(t, err)
}
