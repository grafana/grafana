package v0alpha1_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
	"k8s.io/kube-openapi/pkg/validation/strfmt"
	"k8s.io/kube-openapi/pkg/validation/validate"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestSecureValues(t *testing.T) {
	t.Run("redaction", func(t *testing.T) {
		expected := "[REDACTED]"

		rawValue := "a-password"
		esv := common.NewSecretValue(rawValue)

		// String must not return the exposed secure value.
		require.Equal(t, expected, esv.String())
		require.Equal(t, expected, esv.GoString())

		// Format/GoString must not return the exposed secure value.
		require.Equal(t, expected, fmt.Sprintf("%+#v", esv))
		require.Equal(t, expected, fmt.Sprintf("%v", esv))
		require.Equal(t, expected, fmt.Sprintf("%s", esv))

		buf := new(bytes.Buffer)
		_, err := fmt.Fprintf(buf, "%#v", esv)
		require.NoError(t, err)
		require.Equal(t, expected, buf.String())

		// MarshalJSON must not return the exposed secure value.
		bytes, err := json.Marshal(esv)
		require.NoError(t, err)
		require.Equal(t, `"`+expected+`"`, string(bytes))

		// MarshalYAML must not return the exposed secure value.
		bytes, err = yaml.Marshal(esv)
		require.NoError(t, err)
		require.Equal(t, "'"+expected+"'\n", string(bytes))

		// DangerouslyExposeAndConsumeValue returns the raw value.
		require.Equal(t, rawValue, esv.DangerouslyExposeAndConsumeValue())

		// Further calls to DangerouslyExposeAndConsumeValue will panic.
		require.Panics(t, func() { esv.DangerouslyExposeAndConsumeValue() })
	})

	t.Run("Inline", func(t *testing.T) {
		t.Run("IsZero", func(t *testing.T) {
			require.True(t, common.InlineSecureValue{}.IsZero())
			require.True(t, common.NewSecretValue("").IsZero())
			require.True(t, common.InlineSecureValue{Remove: false}.IsZero())

			require.False(t, common.NewSecretValue("X").IsZero())
			require.False(t, common.InlineSecureValue{Name: "X"}.IsZero())
			require.False(t, common.InlineSecureValue{Remove: true}.IsZero())
		})

		t.Run("Validate OneOf", func(t *testing.T) {
			def := common.InlineSecureValue{}.OpenAPIDefinition()
			// jj, _ := json.MarshalIndent(def.Schema, "", "  ")
			// fmt.Printf("%s", string(jj))
			// t.FailNow()

			validator := validate.NewSchemaValidator(&def.Schema, nil, "", strfmt.Default)

			tests := []struct {
				name  string
				input map[string]any
				valid bool
				err   string
			}{
				{
					name:  "with name",
					input: map[string]any{"name": "x"},
					valid: true,
				},
				{
					name:  "with create",
					input: map[string]any{"create": "x"},
					valid: true,
				},
				{
					name:  "with remove",
					input: map[string]any{"remove": true},
					valid: true,
				},
				{
					name:  "empty",
					input: map[string]any{},
					valid: false,
					err:   "must validate one and only one",
				},
				{
					name:  "with unknown property",
					input: map[string]any{"unknown": "property"},
					valid: false,
					err:   "unknown",
				},
			}
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					result := validator.Validate(tt.input)
					require.Equal(t, tt.valid, result.IsValid())
					if tt.err == "" {
						require.NoError(t, result.AsError())
					} else {
						require.ErrorContains(t, result.AsError(), tt.err)
					}
				})
			}
		})
	})
}
