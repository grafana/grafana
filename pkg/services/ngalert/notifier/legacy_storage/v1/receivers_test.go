package v1

import (
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
