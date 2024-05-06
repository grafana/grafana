package notifier

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	tc := []struct {
		name              string
		rawConfig         string
		expectedTemplates map[string]string
		expectedError     error
	}{
		{
			name: "with a valid config and template",
			rawConfig: `
{
  "alertmanager_config": {
    "global": {
      "smtp_from": "noreply@grafana.net"
    },
    "route": {
      "receiver": "email"
    },
    "receivers": [
      {
        "name": "email"
      }
    ]
  },
  "template_files": {
    "email.template": "something with a pretty good content"
  }
}
`,
			expectedTemplates: map[string]string{"email.template": "something with a pretty good content"},
		},
		{
			name:          "with an empty configuration, it is not valid.",
			rawConfig:     "{}",
			expectedError: errors.New("unable to parse Alertmanager configuration: no route provided in config"),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			c, err := Load([]byte(tt.rawConfig))

			if tt.expectedError != nil {
				assert.Nil(t, c)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				assert.NotNil(t, c.TemplateFiles)
				assert.Equal(t, tt.expectedTemplates, c.TemplateFiles)
			}
		})
	}
}
