package pluginsettings

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestToSecureJsonFields(t *testing.T) {
	t.Run("When secrets is passed to function, it should return fields with boolean values", func(t *testing.T) {
		secrets := map[string]string{
			"secret1": "asdf123",
			"secret2": "fasdf123",
		}

		fields := ToSecureJsonFields(secrets)

		assert.Equal(t, 2, len(fields))
		assert.Equal(t, fields["secret1"], true)
		assert.Equal(t, fields["secret2"], true)
	})

	t.Run("When no secrets is passed to function, it should return empty fields map", func(t *testing.T) {
		secrets := map[string]string{}

		fields := ToSecureJsonFields(secrets)

		assert.Equal(t, 0, len(fields))
	})
}
