package v1

import (
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1/store"
)

func TestReceiverFingerprint(t *testing.T) {
	baseReceiver := func() PostableApiReceiver {
		return PostableApiReceiver{
			ResourceMetadata: ResourceMetadata{
				UID:        ReceiverUID("test-receiver"),
				Version:    "some-version",
				Provenance: models.ProvenanceAPI,
			},
			Name: "test-receiver",
			GrafanaManagedReceivers: []*PostableGrafanaReceiver{
				{
					UID:                   "integration-uid",
					Name:                  "test-receiver",
					Type:                  "slack",
					Version:               "v1",
					DisableResolveMessage: true,
					Settings:              []byte(`{"url":"https://example.com"}`),
					SecureSettings:        map[string]string{"token": "abc123"},
				},
			},
		}
	}

	t.Run("stable across equal values", func(t *testing.T) {
		assert.Equal(t, ReceiverFingerprint(baseReceiver()), ReceiverFingerprint(baseReceiver()))
	})

	t.Run("changes when integration content changes", func(t *testing.T) {
		fingerprint := ReceiverFingerprint(baseReceiver())
		changed := baseReceiver()
		changed.GrafanaManagedReceivers[0].Settings = []byte(`{"url":"https://example.com/other"}`)
		assert.NotEqual(t, fingerprint, ReceiverFingerprint(changed))
	})

	t.Run("changes when secure settings change", func(t *testing.T) {
		fingerprint := ReceiverFingerprint(baseReceiver())
		changed := baseReceiver()
		changed.GrafanaManagedReceivers[0].SecureSettings = map[string]string{"token": "different"}
		assert.NotEqual(t, fingerprint, ReceiverFingerprint(changed))
	})

	t.Run("stable across metadata modification", func(t *testing.T) {
		fingerprint := ReceiverFingerprint(baseReceiver())

		metadataType := reflect.TypeFor[ResourceMetadata]()
		otherMetadata := reflect.ValueOf(ResourceMetadata{
			UID:        "some-other-uid",
			Version:    "some-other-version",
			Provenance: models.ProvenanceFile,
		})
		for i := 0; i < metadataType.NumField(); i++ {
			field := metadataType.Field(i).Name
			cp := baseReceiver()

			vf := reflect.ValueOf(&cp.ResourceMetadata).Elem().Field(i)
			other := otherMetadata.Field(i)
			require.NotEqualf(t, other.Interface(), vf.Interface(),
				"ResourceMetadata field %s is the same as the original, test does not ensure stability across the field", field)
			vf.Set(other)

			assert.Equalf(t, fingerprint, ReceiverFingerprint(cp),
				"ResourceMetadata field %s should not be part of the fingerprint", field)
		}
	})
}

func TestNewReceiver(t *testing.T) {
	r := NewReceiver("custom-uid", "my-receiver", nil, models.ProvenanceAPI)

	assert.Equal(t, ResourceUID("custom-uid"), r.UID)
	assert.Equal(t, ReceiverFingerprint(r), r.Version)
	assert.Equal(t, models.ProvenanceAPI, r.Provenance)
}

func TestResolveReceiverUID(t *testing.T) {
	assert.Equal(t, ResourceUID("persisted"), ResolveReceiverUID("persisted", "name"), "a UID that is stored is used as it is")
	assert.Equal(t, ReceiverUID("name"), ResolveReceiverUID("", "name"), "without one it is derived from the name")
}

func TestReceiversToModel_UIDs(t *testing.T) {
	got := ReceiversToModel([]*store.ReceiverDB{
		{UID: "persisted", Name: "has uid"},
		{Name: "no uid"},
	})

	require.Len(t, got, 2)
	require.Contains(t, got, ResourceUID("persisted"))
	assert.Equal(t, "has uid", got["persisted"].Name)
	assert.Equal(t, ResourceUID("persisted"), got["persisted"].UID)
	require.Contains(t, got, ReceiverUID("no uid"))
	assert.Equal(t, ReceiverUID("no uid"), got[ReceiverUID("no uid")].UID)
}

func TestValidateReceiverUID(t *testing.T) {
	for _, uid := range []string{"a", "my-receiver", "my.receiver-1", "0123", strings.Repeat("a", 40)} {
		assert.NoErrorf(t, ValidateReceiverUID(uid), "%q should be valid", uid)
	}
	for description, uid := range map[string]string{
		"empty":             "",
		"blank":             "  ",
		"colon":             "my:receiver",
		"uppercase":         "My-Receiver",
		"underscore":        "my_receiver",
		"leading hyphen":    "-receiver",
		"trailing hyphen":   "receiver-",
		"slash":             "my/receiver",
		"longer than limit": strings.Repeat("a", 41),
	} {
		assert.Errorf(t, ValidateReceiverUID(uid), "%s should be invalid", description)
	}
}

func TestLegacyReceiverUID(t *testing.T) {
	names := []string{
		"grafana-default-email",
		"Receiver With Spaces",
		"snake_case",
		"with/slash",
		"ünïcödé 工作时间 🕒",
		strings.Repeat("a very long receiver name ", 50),
	}

	seen := map[ResourceUID]string{}
	for _, name := range names {
		uid := ReceiverUID(name)
		assert.Equal(t, uid, ReceiverUID(name), "must be deterministic")
		assert.Empty(t, k8svalidation.IsDNS1123Subdomain(string(uid)), name)
		assert.NoError(t, ValidateReceiverUID(string(uid)), name)
		assert.Len(t, uid, 25)
		assert.NotEqual(t, ResourceUID(models.NameToUid(name)), uid, "must not be the name-based UID")
		other, dup := seen[uid]
		assert.Falsef(t, dup, "%q and %q share a UID", name, other)
		seen[uid] = name
	}
}

func TestLegacyReceiverPermissionIdentifier(t *testing.T) {
	// It must stay what permissions to a receiver without a persisted UID are scoped to, as the migration of those
	// relies on it. The boundary is a name whose base64 encoding is 40 characters long.
	for _, name := range []string{
		"grafana-default-email",
		strings.Repeat("n", 30),
		strings.Repeat("n", 31),
		"ünïcödé 工作时间 🕒",
		strings.Repeat("a very long receiver name ", 50),
	} {
		assert.Equal(t, models.ScopeReceiversProvider.GetResourceIDFromUID(models.NameToUid(name)), legacyReceiverPermissionIdentifier(name), name)
	}
}
