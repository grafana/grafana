package resourcewatch

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestSubject(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    "provisioning.grafana.app",
		Version:  "v0alpha1",
		Resource: "repositories",
	}

	tests := []struct {
		name      string
		gvr       schema.GroupVersionResource
		namespace string
		want      string
	}{
		{
			name:      "namespaced, version-agnostic",
			gvr:       gvr,
			namespace: "default",
			want:      "us.watch.v1.provisioning.grafana.app.default.repositories",
		},
		{
			name:      "empty namespace becomes the single-token wildcard",
			gvr:       gvr,
			namespace: "",
			want:      "us.watch.v1.provisioning.grafana.app.*.repositories",
		},
		{
			name:      "version is ignored",
			gvr:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Version: "v9", Resource: "repositories"},
			namespace: "stacks-1",
			want:      "us.watch.v1.provisioning.grafana.app.stacks-1.repositories",
		},
		{
			name:      "multi-token group keeps its tokens",
			gvr:       schema.GroupVersionResource{Group: "notifications.alerting.grafana.app", Resource: "receivers"},
			namespace: "stacks-1",
			want:      "us.watch.v1.notifications.alerting.grafana.app.stacks-1.receivers",
		},
		{
			name:      "empty resource becomes the single-token wildcard",
			gvr:       schema.GroupVersionResource{Group: "provisioning.grafana.app"},
			namespace: "default",
			want:      "us.watch.v1.provisioning.grafana.app.default.*",
		},
		{
			name:      "groupless resource",
			gvr:       schema.GroupVersionResource{Resource: "configmaps"},
			namespace: "default",
			want:      "us.watch.v1._core.default.configmaps",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Subject(tt.gvr, tt.namespace)
			assert.Equal(t, tt.want, got)
			assert.True(t, subjectMatches(SubjectAllResources, got), "%q must match the firehose", got)
		})
	}
}

func TestSubjectAllResources(t *testing.T) {
	assert.False(t, subjectMatches(SubjectAllResources, "$SYS.SERVER.ACCOUNT.X.CONNS"))
	assert.False(t, subjectMatches(SubjectAllResources, "us.watch.v2.provisioning.grafana.app.default.repositories"))
	assert.False(t, subjectMatches(SubjectAllResources, subjectRoot))
}

// TestGrantSubjects pins the layout against the us-nats auth callout, which
// expands an access-policy grant into a NATS permission. Both sides must agree
// token for token, so the grants are translated here the way the callout does and
// asserted against real Subject(...) output.
func TestGrantSubjects(t *testing.T) {
	tests := []struct {
		grant   string
		want    string
		matches []schema.GroupVersionResource
		misses  []schema.GroupVersionResource
	}{
		{
			grant: "*/*",
			want:  SubjectAllResources,
			matches: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "jobs"},
				{Group: "notifications.alerting.grafana.app", Resource: "receivers"},
				{Resource: "configmaps"},
			},
		},
		{
			grant: "provisioning.grafana.app/jobs",
			want:  "us.watch.v1.provisioning.grafana.app.*.jobs",
			matches: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "jobs"},
			},
			misses: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "repositories"},
				{Group: "jobs.provisioning.grafana.app", Resource: "jobs"},
			},
		},
		{
			grant: "provisioning.grafana.app/*",
			want:  "us.watch.v1.provisioning.grafana.app.*.*",
			matches: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "jobs"},
				{Group: "provisioning.grafana.app", Resource: "repositories"},
			},
			misses: []schema.GroupVersionResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "jobs.provisioning.grafana.app", Resource: "jobs"},
			},
		},
		{
			grant: "*.grafana.app/*",
			want:  "us.watch.v1.*.grafana.app.*.*",
			matches: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "jobs"},
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			misses: []schema.GroupVersionResource{
				{Group: "notifications.alerting.grafana.app", Resource: "receivers"},
				{Group: "provisioning.grafana.com", Resource: "jobs"},
			},
		},
		{
			grant: "*.*.grafana.app/*",
			want:  "us.watch.v1.*.*.grafana.app.*.*",
			matches: []schema.GroupVersionResource{
				{Group: "notifications.alerting.grafana.app", Resource: "receivers"},
				{Group: "loki.datasource.grafana.app", Resource: "datasources"},
			},
			misses: []schema.GroupVersionResource{
				{Group: "provisioning.grafana.app", Resource: "jobs"},
			},
		},
		{
			grant: "*.alerting.grafana.app/receivers",
			want:  "us.watch.v1.*.alerting.grafana.app.*.receivers",
			matches: []schema.GroupVersionResource{
				{Group: "notifications.alerting.grafana.app", Resource: "receivers"},
			},
			misses: []schema.GroupVersionResource{
				{Group: "notifications.alerting.grafana.app", Resource: "templategroups"},
				{Group: "alerting.grafana.app", Resource: "receivers"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.grant, func(t *testing.T) {
			pattern := grantSubject(t, tt.grant)
			require.Equal(t, tt.want, pattern)

			for _, gvr := range tt.matches {
				subject := Subject(gvr, "stacks-1")
				assert.True(t, subjectMatches(pattern, subject), "%q must match %q", pattern, subject)
			}
			for _, gvr := range tt.misses {
				subject := Subject(gvr, "stacks-1")
				assert.False(t, subjectMatches(pattern, subject), "%q must not match %q", pattern, subject)
			}
		})
	}
}

// grantSubject mirrors the us-nats auth callout: a <group>/<resource> grant
// becomes a subject with the group's tokens copied verbatim and the namespace
// wildcarded between group and resource.
//
// A group of exactly "*" is the exception: it stands for every group, whatever
// its token count, which no fixed-width pattern can cover. Only a ">" tail can,
// and ">" is legal only as the final token, so it swallows the resource
// position too — hence the callout expands it to the firehose and a whole-group
// wildcard is only ever granted as "*/*".
func grantSubject(t *testing.T, grant string) string {
	t.Helper()

	group, resource, _ := strings.Cut(grant, "/")
	switch group {
	case "":
		group = coreGroup
	case anyToken:
		require.Equal(t, anyToken, resource, "a %q group can only be granted with a %q resource", anyToken, anyToken)
		return SubjectAllResources
	}
	return strings.Join([]string{subjectRoot, group, anyToken, resource}, ".")
}

// subjectMatches implements NATS subject matching: "*" matches exactly one
// token, ">" matches one or more and only as the final token.
func subjectMatches(pattern, subject string) bool {
	patternTokens := strings.Split(pattern, ".")
	subjectTokens := strings.Split(subject, ".")
	for i, token := range patternTokens {
		if token == ">" {
			return i < len(subjectTokens)
		}
		if i >= len(subjectTokens) {
			return false
		}
		if token != anyToken && token != subjectTokens[i] {
			return false
		}
	}
	return len(patternTokens) == len(subjectTokens)
}
