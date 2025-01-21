import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Text } from '@grafana/ui';

const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'kubernetesFoldersServiceV2',
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
  'kubernetesCliDashboards',
];

const custom_ini = `app_mode = development

[feature_toggles]
provisioning = true
kubernetesFolders = true
kubernetesDashboards = true
grafanaAPIServerWithExperimentalAPIs = true
unifiedStorageSearch = true
unifiedStorageSearchUI = true
kubernetesCliDashboards = true
kubernetesFoldersServiceV2 = true

# If you want easy kubectl setup development mode
grafanaAPIServerEnsureKubectlAccess = true

[unified_storage.dashboards.dashboard.grafana.app]
dualWriterMode = 3

[unified_storage.folders.folder.grafana.app]
dualWriterMode = 3

# For Github webhook support, you will need something like:
[server]
root_url = https://supreme-exact-beetle.ngrok-free.app

[auth.anonymous]
enabled = true`;

const ngrok_example = `
ngrok http 3000
Help shape K8s Bindings https://ngrok.com/new-features-update?ref=k8s

Session Status                online
Account                       Roberto Jiménez Sánchez (Plan: Free)
Version                       3.18.4
Region                        Europe (eu)
Latency                       44ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://d60d-83-33-235-27.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              50      2       0.00    0.00    83.03   90.56

HTTP Requests
-------------

09:18:46.147 CET GET  /favicon.ico                                                                                        302 Found
09:18:46.402 CET GET  /login             
`;

const webhook_ini = `...
[server]
root_url = https://d60d-83-33-235-27.ngrok-free.app

[auth.anonymous]
enabled = true`;

export function SetupWarnings() {
  const missingFeatures = requiredFeatureToggles.filter((feature) => !config.featureToggles[feature]);

  if (missingFeatures.length === 0) {
    return null;
  }

  return (
    <>
      <Alert title="Provisioning Setup Error" severity="error">
        {missingFeatures.map((feature) => (
          <Text key={feature} element={'p'}>
            Missing required feature toggle: <strong>{feature}</strong>
          </Text>
        ))}
      </Alert>
      <Alert title="working custom.ini for local testing" severity="info">
        <pre>{custom_ini}</pre>
        <h5>NOTE: the above config is *not* this machine config</h5>
      </Alert>

      <Alert title="Webhook support" severity="info">
        <h5>Webhook support requires the server to run on a public URL -- and (for now) anonymous access</h5>
        <pre>{webhook_ini}</pre>
        <h5>To setup public access to a local machine, consider ngrok</h5>
        <pre>{ngrok_example}</pre>
      </Alert>
    </>
  );
}
