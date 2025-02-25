import { useLocalStorage } from 'react-use';

import { FeatureToggles, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Text, Collapse, Box } from '@grafana/ui';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from './api';

const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'kubernetesClientDashboardsFolders',
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
];

const custom_ini = `# In your custom.ini file
app_mode = development
[feature_toggles]
provisioning = true
kubernetesDashboards = true
unifiedStorageSearch = true
unifiedStorageSearchUI = true
kubernetesClientDashboardsFolders = true

# If you want easy kubectl setup development mode
grafanaAPIServerEnsureKubectlAccess = true

# For Github webhook support, you will need something like:
[server]
root_url = https://supreme-exact-beetle.ngrok-free.app

# For dashboard preview generation, you will need something like:
[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
 `;

const ngrok_example = `ngrok http 3000

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

09:18:46.147 CET             GET  /favicon.ico                   302 Found
09:18:46.402 CET             GET  /login`;

const webhook_ini = `...

[server]
root_url = https://d60d-83-33-235-27.ngrok-free.app`;

const render_ini = `...
[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
`;

export function SetupWarnings() {
  const [isCustomIniOpen, setCustomIniOpen] = useLocalStorage('collapse_custom_ini', true);
  const [isDisabledFeaturesOpen, setDisabledFeaturesOpen] = useLocalStorage('collapse_disabled_features', false);
  const settings = useGetFrontendSettingsQuery();

  const missingFeatures = requiredFeatureToggles.filter((feature) => !config.featureToggles[feature]);

  const handleCustomIniToggle = () => {
    setCustomIniOpen(!isCustomIniOpen);
  };

  const handleDisabledFeaturesToggle = () => {
    setDisabledFeaturesOpen(!isDisabledFeaturesOpen);
  };

  const styles = useStyles2(getStyles);

  if (
    missingFeatures.length === 0 &&
    settings.data?.githubWebhooks !== false &&
    settings.data?.generateDashboardPreviews !== false
  ) {
    return null;
  }

  return (
    <>
      {missingFeatures.length > 0 && (
        <>
          <Alert title="Missing required features" severity="error">
            <Box marginBottom={2}>
              <Text element="p">
                The following feature toggles are required for proper functionality but are currently disabled:
              </Text>
              {missingFeatures.map((feature) => (
                <li key={feature}>
                  <strong>{feature}</strong>
                </li>
              ))}
            </Box>
            <Collapse
              isOpen={isCustomIniOpen}
              label="See example configuration for local testing"
              onToggle={handleCustomIniToggle}
              collapsible
            >
              <pre>
                <code>{custom_ini}</code>
              </pre>
            </Collapse>
          </Alert>
        </>
      )}

      {(settings.data?.generateDashboardPreviews === false || settings.data?.githubWebhooks === false) && (
        <Alert severity="info" title="Some features are currently unavailable">
          <Box marginBottom={2}>
            <Text element="p">These features enhance your whole experience working with Grafana and GitHub.</Text>
          </Box>

          <Collapse
            isOpen={isDisabledFeaturesOpen}
            label="See how to enable them"
            onToggle={handleDisabledFeaturesToggle}
            collapsible
          >
            <Box marginTop={3}>
              {settings.data?.generateDashboardPreviews === false && (
                <div className={styles.featureSection}>
                  <div className={styles.featureTitle}>
                    <Text element="h5" weight="medium">
                      Dashboard Preview Generation
                    </Text>
                  </div>
                  <Box marginBottom={2}>
                    <Text element="p">This feature generates dashboard preview images in pull requests.</Text>
                  </Box>
                  <Box marginTop={2} marginBottom={1}>
                    <Text element="h6">
                      To connect to the rendering service locally, you need to configure the following:
                    </Text>
                  </Box>
                  <pre className={styles.codeBlock}>
                    <code>{render_ini}</code>
                  </pre>
                </div>
              )}

              {settings.data?.githubWebhooks === false && (
                <div className={styles.featureSection}>
                  <div className={styles.featureTitle}>
                    <Text element="h5" weight="medium">
                      Github Webhook Integration
                    </Text>
                  </div>
                  <Box marginBottom={2}>
                    <Text element="p">
                      This feature automatically syncs resources from GitHub when commits are pushed to the configured
                      branch, eliminating the need for regular polling intervals. It also enhances pull requests by
                      automatically adding preview links and dashboard snapshots.
                    </Text>
                  </Box>
                  <Box marginTop={2} marginBottom={1}>
                    <Text element="h6">To enable webhook support, you need to configure the following:</Text>
                  </Box>
                  <pre className={styles.codeBlock}>
                    <code>{webhook_ini}</code>
                  </pre>
                </div>
              )}

              <div className={styles.featureSection}>
                <div className={styles.featureTitle}>
                  <Text element="h5" weight="medium">
                    Public Access Setup
                  </Text>
                </div>
                <Box marginBottom={2}>
                  <Text element="p">
                    For both features, you'll need to set up public access to your local machine. ngrok is a recommended
                    tool for this:
                  </Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{ngrok_example}</code>
                </pre>
              </div>
            </Box>
          </Collapse>
        </Alert>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    featureSection: css({
      marginBottom: theme.spacing(3),
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    featureTitle: css({
      marginBottom: theme.spacing(1),
    }),
    codeBlock: css({
      marginBottom: theme.spacing(2),
    }),
  };
};
