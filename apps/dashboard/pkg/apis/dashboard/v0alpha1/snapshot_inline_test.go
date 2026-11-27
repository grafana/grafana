package v0alpha1

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func TestSnapshotInlineSchema(t *testing.T) {
	defs := GetOpenAPIDefinitions(func(name string) spec.Ref { return spec.MustCreateRef("#/definitions/" + name) })
	require.NotContains(t, defs[SnapshotSpec{}.OpenAPIModelName()].Schema.Properties, "dashboard")
	blob := defs[SnapshotBlobReference{}.OpenAPIModelName()].Schema
	require.Contains(t, blob.Properties, "data")
	require.NotContains(t, blob.Required, "uid")
}

func TestSnapshotHistoricalDashboardDecode(t *testing.T) {
	for _, reference := range []string{"", `,"blobs":{"dashboard":{}}`, `,"blobs":{"dashboard":{"uid":""}}`} {
		var snap Snapshot
		require.NoError(t, json.Unmarshal([]byte(`{"spec":{"dashboard":{"id":9007199254740993}}`+reference+`}`), &snap))
		value, err := base64.StdEncoding.DecodeString(*snap.Blobs.Dashboard.Data)
		require.NoError(t, err)
		require.JSONEq(t, `{"id":9007199254740993}`, string(value))
		encoded, err := json.Marshal(snap)
		require.NoError(t, err)
		var body map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(encoded, &body))
		require.NotContains(t, string(body["spec"]), "dashboard")
		copy := snap.DeepCopy()
		*copy.Blobs.Dashboard.Data = "changed"
		require.NotEqual(t, *copy.Blobs.Dashboard.Data, *snap.Blobs.Dashboard.Data)
	}
}

func TestSnapshotHistoricalDashboardDoesNotOverrideReference(t *testing.T) {
	var snap Snapshot
	require.NoError(t, json.Unmarshal([]byte(`{"spec":{"dashboard":{"title":"stale"}},"blobs":{"dashboard":{"uid":"authoritative"}}}`), &snap))
	require.Nil(t, snap.Blobs.Dashboard.Data)
	require.Equal(t, "authoritative", *snap.Blobs.Dashboard.Uid)
}

func TestDashboardSnapshotWithDeleteKeyDecode(t *testing.T) {
	var response DashboardSnapshotWithDeleteKey
	require.NoError(t, json.Unmarshal([]byte(`{"metadata":{"name":"example"},"spec":{"dashboard":{"id":9007199254740993}},"deleteKey":"secret"}`), &response))
	require.Equal(t, "example", response.Name)
	require.Equal(t, "secret", response.DeleteKey)
	require.NotNil(t, response.Blobs.Dashboard)
	value, err := base64.StdEncoding.DecodeString(*response.Blobs.Dashboard.Data)
	require.NoError(t, err)
	require.JSONEq(t, `{"id":9007199254740993}`, string(value))
}

func TestSnapshotInlinePresenceValidation(t *testing.T) {
	for _, blob := range []string{
		`{"data":null}`, `{"data":""}`, `{"data":123}`,
		`{"data":"e30=","uid":null}`, `{"data":"e30=","size":null}`,
		`{"data":"e30=","extension":true}`,
	} {
		t.Run(blob, func(t *testing.T) {
			var snap Snapshot
			require.Error(t, json.Unmarshal([]byte(`{"blobs":{"dashboard":`+blob+`}}`), &snap))
		})
	}
}
