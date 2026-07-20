package jobs

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
		enabled     bool
		annotations map[string]string
		expected    map[string]string
	}{
		{
			name:      "user with attribution enabled sets author annotations",
			operation: admission.Create,
			requester: userRequester,
			enabled:   true,
			expected: map[string]string{
				AnnoAuthor:      "Test User",
				AnnoAuthorEmail: "test@example.com",
			},
		},
		{
			name:        "client-supplied annotations are overwritten by the requester",
			operation:   admission.Create,
			requester:   userRequester,
			enabled:     true,
			annotations: map[string]string{AnnoAuthor: "Spoofed", AnnoAuthorEmail: "spoof@evil.com"},
			expected: map[string]string{
				AnnoAuthor:      "Test User",
				AnnoAuthorEmail: "test@example.com",
			},
		},
		{
			name:        "attribution disabled strips client-supplied annotations",
			operation:   admission.Create,
			requester:   userRequester,
			enabled:     false,
			annotations: map[string]string{AnnoAuthor: "Spoofed", AnnoAuthorEmail: "spoof@evil.com"},
			expected:    map[string]string{},
		},
		{
			name:      "service identity strips client-supplied annotations",
			operation: admission.Create,
			requester: &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy,
				Name: "provisioning",
			},
			enabled:     true,
			annotations: map[string]string{AnnoAuthor: "Spoofed"},
			expected:    map[string]string{},
		},
		{
			name:        "user cannot set webhook annotations",
			operation:   admission.Create,
			requester:   userRequester,
			enabled:     true,
			annotations: map[string]string{AnnoWebhookSender: "spoof", AnnoWebhookSenderID: "1"},
			expected: map[string]string{
				AnnoAuthor:      "Test User",
				AnnoAuthorEmail: "test@example.com",
			},
		},
		{
			name:      "provisioning service identity keeps webhook annotations",
			operation: admission.Create,
			requester: &identity.StaticRequester{
				Type:    authlib.TypeAccessPolicy,
				UserUID: "provisioning",
			},
			enabled:     false,
			annotations: map[string]string{AnnoWebhookSender: "grot", AnnoWebhookSenderID: "123"},
			expected:    map[string]string{AnnoWebhookSender: "grot", AnnoWebhookSenderID: "123"},
		},
		{
			name:        "non-create operation is left untouched",
			operation:   admission.Update,
			requester:   userRequester,
			enabled:     true,
			annotations: map[string]string{AnnoAuthor: "Existing"},
			expected:    map[string]string{AnnoAuthor: "Existing"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}

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

			mutator := NewAdmissionMutator(func(context.Context) bool { return tt.enabled })
			require.NoError(t, mutator.Mutate(ctx, attrs, nil))

			// The mutator only ever touches the attribution annotations; assert
			// on exactly those to confirm none are left stray.
			got := map[string]string{}
			for _, k := range []string{AnnoAuthor, AnnoAuthorEmail, AnnoWebhookSender, AnnoWebhookSenderID} {
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
	mutator := NewAdmissionMutator(func(context.Context) bool { return true })
	require.Error(t, mutator.Mutate(context.Background(), attrs, nil))
}
