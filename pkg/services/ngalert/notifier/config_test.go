package notifier

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestLoad(t *testing.T) {
	tc := []struct {
		name              string
		rawConfig         string
		expectedTemplates map[v1.ResourceUID]v1.TemplateGroup
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
			expectedTemplates: map[v1.ResourceUID]v1.TemplateGroup{v1.TemplateUID(v1.TemplateKindGrafana, "email.template"): v1.NewTemplateGroup("email.template", "something with a pretty good content", v1.TemplateKindGrafana, ngmodels.ProvenanceNone)},
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
				assert.NotNil(t, c.Templates)
				assert.Equal(t, tt.expectedTemplates, c.Templates)
			}
		})
	}
}
