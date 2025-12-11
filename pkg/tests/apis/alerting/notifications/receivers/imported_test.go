package receivers

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path"
	"testing"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	test_common "github.com/grafana/grafana/pkg/tests/apis/alerting/notifications/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationReadImported_Snapshot(t *testing.T) {
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		},
	})

	receiverClient := test_common.NewReceiverClient(t, helper.Org1.Admin)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	configYaml, err := testData.ReadFile(path.Join("test-data", "imported.yaml"))
	require.NoError(t, err)

	identifier := "test-create-get-config"
	mergeMatchers := "_imported=true"

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": identifier,
		"X-Grafana-Alerting-Merge-Matchers":    mergeMatchers,
	}

	amConfig := apimodels.AlertmanagerUserConfig{
		AlertmanagerConfig: string(configYaml),
	}

	response := alertingApi.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
	require.Equal(t, "success", response.Status)

	receiversRaw, err := receiverClient.Client.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	raw, err := receiversRaw.MarshalJSON()
	require.NoError(t, err)

	expectedBytes, err := os.ReadFile(path.Join("test-data", "imported-expected-snapshot.json"))
	require.NoError(t, err)

	if !assert.JSONEq(t, string(expectedBytes), string(raw)) {
		var prettyJSON bytes.Buffer
		err := json.Indent(&prettyJSON, raw, "", "  ")
		require.NoError(t, err)
		err = os.WriteFile(path.Join("test-data", "imported-expected-snapshot.json"), prettyJSON.Bytes(), 0o644)
		require.NoError(t, err)
	}

	receivers, err := receiverClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	t.Run("secure fields should be properly masked", func(t *testing.T) {
		for _, receiver := range receivers.Items {
			if receiver.Spec.Title == "grafana-default-email" {
				continue
			}
			for _, integration := range receiver.Spec.Integrations {
				sch, ok := notify.GetSchemaVersionForIntegration(schema.IntegrationType(integration.Type), schema.Version(integration.Version))
				require.Truef(t, ok, "unknown integration type %s and version %s", integration.Type, integration.Version)
				keys := flattenKeys(integration.Settings)
				secrets := make(map[string]struct{})
				for _, fieldPath := range sch.GetSecretFieldsPaths() {
					assert.NotContainsf(t, keys, fieldPath.String(), "receiver %s integration %s has secret field %s", receiver.Name, integration.Type, fieldPath.String())
					secrets[fieldPath.String()] = struct{}{}
				}
				for key := range integration.SecureFields {
					assert.Containsf(t, secrets, key, "receiver %s integration %s has secure field %s that is not in the schema", receiver.Name, integration.Type, key)
				}
			}
		}
	})
	t.Run("should set the correct annotations", func(t *testing.T) {
		for _, receiver := range receivers.Items {
			if receiver.Spec.Title == "grafana-default-email" {
				continue
			}
			assert.EqualValuesf(t, models.ProvenanceConvertedPrometheus, receiver.GetProvenanceStatus(), "receiver %s has unexpected provenance", receiver.Name)
			assert.Equalf(t, "false", receiver.Annotations[v0alpha1.CanUseAnnotationKey], "receiver %s has unexpected can use annotation", receiver.Name)
			assert.Equalf(t, "", receiver.Annotations[v0alpha1.AccessControlAnnotation("canAdmin")], "receiver %s has unexpected can admin annotation", receiver.Name)
			assert.Equalf(t, "", receiver.Annotations[v0alpha1.AccessControlAnnotation("canDelete")], "receiver %s has unexpected can delete annotation", receiver.Name)
			assert.Equalf(t, "true", receiver.Annotations[v0alpha1.AccessControlAnnotation("canReadSecrets")], "receiver %s has unexpected can read secrets annotation", receiver.Name)
			assert.Equalf(t, "", receiver.Annotations[v0alpha1.AccessControlAnnotation("canWrite")], "receiver %s has unexpected can write annotation", receiver.Name)
		}
	})

	t.Run("should not be able to update", func(t *testing.T) {
		toUpdate := receivers.Items[1]
		toUpdate.Spec.Title = "another title"

		_, err = receiverClient.Update(ctx, &toUpdate, v1.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	t.Run("should not be able to delete", func(t *testing.T) {
		toDelete := receivers.Items[1]

		err = receiverClient.Delete(ctx, toDelete.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})
}

func flattenKeys(m map[string]any) map[string]struct{} {
	result := map[string]struct{}{}
	flattenHelper("", m, result)
	return result
}

func flattenHelper(prefix string, m map[string]any, result map[string]struct{}) {
	for key, value := range m {
		newKey := key
		if prefix != "" {
			newKey = prefix + "." + key
		}

		if valMap, ok := value.(map[string]any); ok {
			flattenHelper(newKey, valMap, result)
		} else {
			result[newKey] = struct{}{}
		}
	}
}
