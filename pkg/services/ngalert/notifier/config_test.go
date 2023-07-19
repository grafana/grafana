package notifier

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestPersistTemplates(t *testing.T) {
	tc := []struct {
		name              string
		templates         map[string]string
		existingTemplates map[string]string
		expectedPaths     []string
		expectedError     error
		expectedChange    bool
	}{
		{
			name:           "With valid templates file names, it persists successfully",
			templates:      map[string]string{"email.template": "a perfectly fine template"},
			expectedChange: true,
			expectedError:  nil,
			expectedPaths:  []string{"email.template"},
		},
		{
			name:          "With a invalid filename, it fails",
			templates:     map[string]string{"adirectory/email.template": "a perfectly fine template"},
			expectedError: errors.New("template file name 'adirectory/email.template' is not valid"),
		},
		{
			name:              "with a template that has the same name but different content to an existing one",
			existingTemplates: map[string]string{"email.template": "a perfectly fine template"},
			templates:         map[string]string{"email.template": "a completely different content"},
			expectedChange:    true,
			expectedError:     nil,
			expectedPaths:     []string{"email.template"},
		},
		{
			name:              "with a template that has the same name and the same content as an existing one",
			existingTemplates: map[string]string{"email.template": "a perfectly fine template"},
			templates:         map[string]string{"email.template": "a perfectly fine template"},
			expectedChange:    false,
			expectedError:     nil,
			expectedPaths:     []string{"email.template"},
		},
		{
			name:              "with two new template files, it changes the template tree",
			existingTemplates: map[string]string{"email.template": "a perfectly fine template"},
			templates:         map[string]string{"slack.template": "a perfectly fine template", "webhook.template": "a webhook template"},
			expectedChange:    true,
			expectedError:     nil,
			expectedPaths:     []string{"slack.template", "webhook.template"},
		},
		{
			name:              "when we remove a template file from the list, it changes the template tree",
			existingTemplates: map[string]string{"slack.template": "a perfectly fine template", "webhook.template": "a webhook template"},
			templates:         map[string]string{"slack.template": "a perfectly fine template"},
			expectedChange:    true,
			expectedError:     nil,
			expectedPaths:     []string{"slack.template"},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			// Write "existing files"
			for name, content := range tt.existingTemplates {
				err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644)
				require.NoError(t, err)
			}
			c := &api.PostableUserConfig{TemplateFiles: tt.templates}

			testLogger := logtest.Fake{}
			paths, changed, persistErr := PersistTemplates(&testLogger, c, dir)

			files := map[string]string{}
			readFiles, err := os.ReadDir(dir)
			require.NoError(t, err)
			for _, f := range readFiles {
				if f.IsDir() || f.Name() == "" {
					continue
				}
				// Safe to disable, this is a test.
				// nolint:gosec
				content, err := os.ReadFile(filepath.Join(dir, f.Name()))
				// nolint:gosec
				require.NoError(t, err)
				files[f.Name()] = string(content)
			}

			require.Equal(t, tt.expectedError, persistErr)
			require.ElementsMatch(t, tt.expectedPaths, paths)
			require.Equal(t, tt.expectedChange, changed)
			if tt.expectedError == nil {
				require.Equal(t, tt.templates, files)
			}
		})
	}
}

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
