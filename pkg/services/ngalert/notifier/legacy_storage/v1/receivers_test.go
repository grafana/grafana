package v1

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
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
	r := NewReceiver("my-receiver", nil, models.ProvenanceAPI)

	assert.Equal(t, ReceiverUID("my-receiver"), r.UID)
	assert.Equal(t, ReceiverFingerprint(r), r.Version)
	assert.Equal(t, models.ProvenanceAPI, r.Provenance)
}
