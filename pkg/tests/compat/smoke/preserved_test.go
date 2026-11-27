package smoke

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/compat"
)

func TestPreservationError(t *testing.T) {
	for _, tc := range []struct {
		name      string
		want, got string
		ok        bool
	}{
		{"same", `{"a":1,"b":"x"}`, `{"a":1,"b":"x"}`, true},
		{"defaults added", `{"a":1}`, `{"a":1,"refresh":"","intervals":["5s"]}`, true},
		{"empty values dropped", `{"a":1,"b":"","c":false,"d":[],"e":{"list":[]}}`, `{"a":1}`, true},
		{"empty object gets defaults", `{"timepicker":{}}`, `{"timepicker":{"refresh_intervals":["5s"]}}`, true},
		{"value lost", `{"title":"x"}`, `{}`, false},
		{"value changed", `{"title":"x"}`, `{"title":"y"}`, false},
		{"zero kept significant", `{"n":0}`, `{}`, false},
		{"false replaced", `{"hide":false}`, `{"hide":true}`, false},
		{"empty string replaced", `{"timezone":""}`, `{"timezone":"utc"}`, false},
		{"empty list replaced", `{"links":[]}`, `{"links":[{"url":"x"}]}`, false},
		{"null replaced", `{"x":null}`, `{"x":"set"}`, false},
		{"nested empty replaced", `{"templating":{"list":[]}}`, `{"templating":{"list":[{"name":"v"}]}}`, false},
		{"large integer changed", `{"id":9007199254740992}`, `{"id":9007199254740993}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := preservationErrorJSON([]byte(tc.want), []byte(tc.got))
			if tc.ok {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestSameSpecError(t *testing.T) {
	for _, tc := range []struct {
		name      string
		want, got string
		ok        bool
	}{
		{"same", `{"a":1,"b":"x"}`, `{"b":"x","a":1}`, true},
		{"value changed", `{"a":1}`, `{"a":2}`, false},
		{"field added", `{"a":1}`, `{"a":1,"b":2}`, false},
		{"large integer changed", `{"id":9007199254740992}`, `{"id":9007199254740993}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := sameSpecError([]byte(tc.want), []byte(tc.got))
			if tc.ok {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestAcceptedStaleWriteError(t *testing.T) {
	gr := schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}
	require.NoError(t, acceptedStaleWriteError(gr, nil), "accepted stale write")
	require.Error(t, acceptedStaleWriteError(gr, apierrors.NewConflict(gr, "x", errors.New("stale"))), "conflict means the entry is stale")
	require.Error(t, acceptedStaleWriteError(gr, apierrors.NewInternalError(errors.New("boom"))), "any other error is a failed write")
}

func TestResolveWithoutAllSection(t *testing.T) {
	f := skipFile{
		OSS:        map[string]string{"a.example.grafana.app": "oss reason"},
		Enterprise: map[string]string{"a.example.grafana.app": "enterprise reason"},
	}
	skips, _ := f.resolve()
	require.Len(t, skips, 1)
}

func TestUnservedSkipEntries(t *testing.T) {
	served := map[schema.GroupResource]compat.Resource{
		{Group: "example.grafana.app", Resource: "served"}: {Versions: []string{"v1"}},
	}
	f := skipFile{
		All:                map[string]string{"served.example.grafana.app": "x", "gone.example.grafana.app": "x"},
		OSS:                map[string]string{"gone-oss.example.grafana.app": "x"},
		Enterprise:         map[string]string{"gone-enterprise.example.grafana.app": "x"},
		FeatureFlags:       map[string]string{"gone-flag.example.grafana.app": "some.flag"},
		APIVersionMismatch: map[string]apiVersionWaiver{"gone-mismatch.example.grafana.app": {Version: "v1", Read: "list item"}},
	}
	// The Enterprise build serves everything OSS does, so it checks every section but oss.
	require.Equal(t, []string{
		"all: gone.example.grafana.app",
		"api_version_mismatch: gone-mismatch.example.grafana.app",
		"enterprise: gone-enterprise.example.grafana.app",
		"feature_flags: gone-flag.example.grafana.app",
	}, unservedSkipEntries(f, served, true))
	require.Equal(t, []string{
		"all: gone.example.grafana.app",
		"oss: gone-oss.example.grafana.app",
	}, unservedSkipEntries(f, served, false))
}

func TestAPIVersionWaiver(t *testing.T) {
	w := apiVersionWaiver{Version: "v1beta1", Read: "list item"}
	require.True(t, w.covers("list item", "v1beta1"))
	require.False(t, w.covers("get", "v1beta1"), "another kind of read")
	require.False(t, w.covers("list item", "v1"), "another version")
	require.False(t, apiVersionWaiver{}.covers("list item", "v1beta1"), "no entry")
}
