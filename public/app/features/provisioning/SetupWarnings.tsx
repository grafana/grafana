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

const custom_ini = `app_mode = development

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
  const [isWebhookOpen, setWebhookOpen] = useLocalStorage('collapse_webhook', true);
  const [isDashboardPreviewOpen, setDashboardPreviewOpen] = useLocalStorage('collapse_dashboard_preview', true);
  const settings = useGetFrontendSettingsQuery();

  const missingFeatures = requiredFeatureToggles.filter((feature) => !config.featureToggles[feature]);

  const handleCustomIniToggle = () => {
    setCustomIniOpen(!isCustomIniOpen);
  };

  const handleWebhookToggle = () => {
    setWebhookOpen(!isWebhookOpen);
  };
  const handleDashboardPreviewToggle = () => {
    setDashboardPreviewOpen(!isDashboardPreviewOpen);
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
        <Alert title="Provisioning Setup Error" severity="error">
          {missingFeatures.map((feature) => (
            <Text key={feature} element="p">
              Missing required feature toggle: <strong>{feature}</strong>
            </Text>
          ))}
        </Alert>
      )}

      <Collapse
        isOpen={isCustomIniOpen}
        label="Working custom.ini for local testing"
        onToggle={handleCustomIniToggle}
        collapsible
      >
        <Alert severity="info" title="">
          <pre>
            <code>{custom_ini}</code>
          </pre>
          <Text element="h5">
            NOTE: the above config is <strong>not</strong> this machine's config
          </Text>
        </Alert>
      </Collapse>
      {(settings.data?.generateDashboardPreviews === false || settings.data?.githubWebhooks === false) && (
        <Alert
          severity="info"
          title={<div className={styles.mainTitle}>You can still use this but some cool features are disabled</div>}
        >
          {settings.data?.generateDashboardPreviews === false && (
            <div className={styles.featureSection}>
              <div className={styles.featureTitle}>
                <Text element="h4" weight="medium">
                  Dashboard Preview Generation
                </Text>
              </div>
              <Box marginBottom={2}>
                <Text element="p">This feature generates dashboard preview images in pull requests.</Text>
              </Box>
              <Collapse
                isOpen={isDashboardPreviewOpen}
                label="Details"
                onToggle={handleDashboardPreviewToggle}
                collapsible
                className={styles.detailsCollapse}
              >
                <Box marginTop={2} marginBottom={1}>
                  <Text element="h5">
                    To connect to the rendering service locally, you need to configure the following:
                  </Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{render_ini}</code>
                </pre>
                <Box marginTop={2} marginBottom={1}>
                  <Text element="h5">To enable webhook support, you need to configure the following:</Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{webhook_ini}</code>
                </pre>
                <Box marginTop={2} marginBottom={1}>
                  <Text element="h5">To set up public access to a local machine, consider ngrok</Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{ngrok_example}</code>
                </pre>
              </Collapse>
            </div>
          )}

          {settings.data?.githubWebhooks === false && (
            <div className={styles.featureSection}>
              <div className={styles.featureTitle}>
                <Text element="h4" weight="medium">
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
              <Collapse
                isOpen={isWebhookOpen}
                label="Details"
                onToggle={handleWebhookToggle}
                collapsible
                className={styles.detailsCollapse}
              >
                <Box marginTop={2} marginBottom={1}>
                  <Text element="h5">To enable webhook support, you need to configure the following:</Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{webhook_ini}</code>
                </pre>
                <Box marginTop={2} marginBottom={1}>
                  <Text element="h5">To set up public access to a local machine, consider ngrok</Text>
                </Box>
                <pre className={styles.codeBlock}>
                  <code>{ngrok_example}</code>
                </pre>
              </Collapse>
            </div>
          )}
        </Alert>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    mainTitle: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
      marginBottom: theme.spacing(2),
      color: theme.colors.text.primary,
    }),
    featureSection: css({
      marginBottom: theme.spacing(3),
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    featureTitle: css({
      marginBottom: theme.spacing(1),
    }),
    detailsCollapse: css({
      marginTop: theme.spacing(1),
    }),
    codeBlock: css({
      marginBottom: theme.spacing(2),
    }),
  };
};
