import { css } from '@emotion/css';
import { useState } from 'react';

import { Alert, Stack, Text, Box } from '@grafana/ui';
import { useGetFrontendSettingsQuery, Repository } from 'app/api/clients/provisioning';

import { EnhancedFeatures } from './EnhancedFeatures';
import { FeaturesList } from './FeaturesList';
import { SetupModal } from './SetupModal';
import { getConfigurationStatus } from './features';

type SetupType = 'public-access' | 'required-features' | null;

// Configuration examples
const featureIni = `# In your custom.ini file
app_mode = development

[feature_toggles]
provisioning = true
kubernetesDashboards = true
unifiedStorageSearch = true
kubernetesClientDashboardsFolders = true

# If you want easy kubectl setup development mode
grafanaAPIServerEnsureKubectlAccess = true`;

const ngrokExample = `ngrok http 3000

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

const rootUrlExample = `[server]
root_url = https://d60d-83-33-235-27.ngrok-free.app`;

interface Props {
  items: Repository[];
}

export default function GettingStarted({ items }: Props) {
  const settingsQuery = useGetFrontendSettingsQuery();
  const legacyStorage = settingsQuery.data?.legacyStorage;

  const { hasPublicAccess, hasImageRenderer, hasRequiredFeatures } = getConfigurationStatus();
  const [showInstructionsModal, setShowModal] = useState(false);
  const [setupType, setSetupType] = useState<SetupType>(null);

  const getModalContent = () => {
    switch (setupType) {
      case 'public-access':
        return {
          title: 'Set up public access',
          description: 'Set up public access to your Grafana instance to enable GitHub integration',
          steps: [
            {
              title: 'Start ngrok for temporary public access',
              description: 'Run this command to create a secure tunnel to your local Grafana:',
              code: 'ngrok http 3000',
            },
            {
              title: 'Copy your public URL',
              description: 'From the ngrok output, copy the https:// forwarding URL that looks like this:',
              code: ngrokExample,
              copyCode: false,
            },
            {
              title: 'Update your Grafana configuration',
              description: 'Add this to your custom.ini file, replacing the URL with your actual ngrok URL:',
              code: rootUrlExample,
            },
          ],
        };
      case 'required-features':
        return {
          title: 'Set up required features',
          description: 'Enable required Grafana features for provisioning',
          steps: [
            {
              title: 'Enable Required Feature Toggles',
              description: 'Add these settings to your custom.ini file to enable necessary features:',
              code: featureIni,
            },
          ],
        };
      default:
        return {
          title: '',
          description: '',
          steps: [],
        };
    }
  };

  return (
    <>
      {legacyStorage && (
        <Alert severity="info" title="Setting up this connection could cause a temporary outage">
          When you connect your whole instance, dashboards will be unavailable while running the migration. We recommend
          warning your users before starting the process.
        </Alert>
      )}
      <Stack direction="row" gap={2}>
        <Box width="50%" marginTop={2} paddingTop={2} paddingBottom={2}>
          <FeaturesList
            repos={items}
            hasPublicAccess={hasPublicAccess}
            hasImageRenderer={hasImageRenderer}
            hasRequiredFeatures={hasRequiredFeatures}
            onSetupFeatures={() => {
              setSetupType('required-features');
              setShowModal(true);
            }}
          />
        </Box>
        <Box width="50%">
          <div
            className={css({
              height: `100%`,
              background: `linear-gradient(to right, rgba(255, 179, 102, 0.6), rgba(255, 143, 143, 0.8))`,
              borderRadius: `4px`,
              padding: `16px`,
              display: `flex`,
              alignItems: `center`,
              justifyContent: `center`,
            })}
          >
            <Text variant="h2">Engaging graphic</Text>
          </div>
        </Box>
      </Stack>
      {(!hasPublicAccess || !hasImageRenderer) && (
        <EnhancedFeatures
          hasPublicAccess={hasPublicAccess}
          hasImageRenderer={hasImageRenderer}
          onSetupPublicAccess={() => {
            setSetupType('public-access');
            setShowModal(true);
          }}
        />
      )}
      {showInstructionsModal && setupType && (
        <SetupModal {...getModalContent()} isOpen={showInstructionsModal} onDismiss={() => setShowModal(false)} />
      )}
    </>
  );
}
