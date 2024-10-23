package provisioning

import (
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestPostableGrafanaReceiverToEmbeddedContactPoint(t *testing.T) {
	expectedProvenance := models.KnownProvenances[rand.Intn(len(models.KnownProvenances))]
	tests := []struct {
		name     string
		input    definitions.PostableGrafanaReceiver
		expected definitions.EmbeddedContactPoint
	}{
		{
			name: "should create expected object",
			input: definitions.PostableGrafanaReceiver{
				UID:                   "test-uid",
				Name:                  "test-name",
				Type:                  "test-type",
				DisableResolveMessage: true,
				Settings:              definitions.RawMessage(`{ "name": "test" }`),
			},
			expected: definitions.EmbeddedContactPoint{
				UID:  "test-uid",
				Name: "test-name",
				Type: "test-type",
				Settings: simplejson.NewFromAny(map[string]any{
					"name": "test",
				}),
				DisableResolveMessage: true,
				Provenance:            string(expectedProvenance),
			},
		},
		{
			name: "should merge decrypted secrets into settings",
			input: definitions.PostableGrafanaReceiver{
				Settings: definitions.RawMessage(`{ "name": "test" }`),
				SecureSettings: map[string]string{
					"secret": "data",
				},
			},
			expected: definitions.EmbeddedContactPoint{
				Settings: simplejson.NewFromAny(map[string]any{
					"name":   "test",
					"secret": "data",
				}),
				Provenance: string(expectedProvenance),
			},
		},
		{
			name: "should override existing settings with decrypted secrets into settings",
			input: definitions.PostableGrafanaReceiver{
				Settings: definitions.RawMessage(`{ "name": "test" }`),
				SecureSettings: map[string]string{
					"name": "secret-data",
				},
			},
			expected: definitions.EmbeddedContactPoint{
				Settings: simplejson.NewFromAny(map[string]any{
					"name": "secret-data",
				}),
				Provenance: string(expectedProvenance),
			},
		},
		{
			name: "should support nested secrets",
			input: definitions.PostableGrafanaReceiver{
				Settings: definitions.RawMessage(`{ "name": "test" }`),
				SecureSettings: map[string]string{
					"secret.sub-secret": "data",
				},
			},
			expected: definitions.EmbeddedContactPoint{
				Settings: simplejson.NewFromAny(map[string]any{
					"name": "test",
					"secret": map[string]any{
						"sub-secret": "data",
					},
				}),
				Provenance: string(expectedProvenance),
			},
		},
		{
			name: "should amend to nested structs",
			input: definitions.PostableGrafanaReceiver{
				Settings: definitions.RawMessage(`{ "name": "test", "secret": { "data": "test"} }`),
				SecureSettings: map[string]string{
					"secret.sub-secret": "secret-data",
				},
			},
			expected: definitions.EmbeddedContactPoint{
				Settings: simplejson.NewFromAny(map[string]any{
					"name": "test",
					"secret": map[string]any{
						"data":       "test",
						"sub-secret": "secret-data",
					},
				}),
				Provenance: string(expectedProvenance),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var decrypted []string
			decrypt := func(s string) string {
				decrypted = append(decrypted, s)
				return s
			}
			embeddedContactPoint, err := PostableGrafanaReceiverToEmbeddedContactPoint(&tt.input, expectedProvenance, decrypt)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, embeddedContactPoint)
			assert.ElementsMatch(t, maps.Values(tt.input.SecureSettings), decrypted)
		})
	}
}
