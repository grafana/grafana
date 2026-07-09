package jobs

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestAdmissionMutator_Mutate(t *testing.T) {
	userRequester := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "u123",
		Name:    "Test User",
		Email:   "test@example.com",
	}
	authorAnnotations := map[string]string{
		AnnoAuthor:      "Test User",
		AnnoAuthorEmail: "test@example.com",
		AnnoAuthorID:    "user:u123",
	}

	tests := []struct {
		name        string
		requester   identity.Requester
		enabled     bool
		operation   admission.Operation
		annotations map[string]string
		expected    map[string]string
	}{
		{
			name:      "user create sets author annotations",
			requester: userRequester,
			enabled:   true,
			operation: admission.Create,
			expected:  authorAnnotations,
		},
		{
			name:        "user create overwrites provided annotations",
			requester:   userRequester,
			enabled:     true,
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthor: "Someone Else"},
			expected:    authorAnnotations,
		},
		{
			name:        "flag disabled strips author annotations",
			requester:   userRequester,
			enabled:     false,
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthor: "Test User", AnnoAuthorEmail: "test@example.com", AnnoAuthorID: "user:u123", "other": "kept"},
			expected:    map[string]string{"other": "kept"},
		},
		{
			name: "service identity keeps provided annotations",
			requester: &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy,
				Name: "provisioning",
			},
			enabled:     true,
			operation:   admission.Create,
			annotations: authorAnnotations,
			expected:    authorAnnotations,
		},
		{
			name:        "update is not mutated",
			requester:   userRequester,
			enabled:     true,
			operation:   admission.Update,
			annotations: map[string]string{AnnoAuthor: "Someone Else"},
			expected:    map[string]string{AnnoAuthor: "Someone Else"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}

			job := &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job", Annotations: tt.annotations},
			}
			m := NewAdmissionMutator(func(context.Context) bool { return tt.enabled })

			err := m.Mutate(ctx, newAdmissionTestAttributes(job, tt.operation), nil)
			require.NoError(t, err)
			require.Equal(t, tt.expected, job.Annotations)
		})
	}
}
