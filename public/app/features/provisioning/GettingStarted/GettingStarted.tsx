import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TFunction, Trans, useTranslate } from '@grafana/i18n';
import { Alert, Stack, useStyles2 } from '@grafana/ui';
import { useGetFrontendSettingsQuery, Repository } from 'app/api/clients/provisioning';
import provisioningSvg from 'img/provisioning/provisioning.svg';

import { EnhancedFeatures } from './EnhancedFeatures';
import { FeaturesList } from './FeaturesList';
import { SetupModal } from './SetupModal';
import { getConfigurationStatus } from './features';

type SetupType = 'public-access' | 'required-features' | null;

// Configuration examples
const featureIni = `# In your custom.ini file

[feature_toggles]
provisioning = true
kubernetesDashboards = true ; use k8s from browser
`;

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

const getModalContent = (setupType: SetupType, t: TFunction) => {
  switch (setupType) {
    case 'public-access':
      return {
        title: t('provisioning.getting-started.modal-title-set-up-public-access', 'Set up public access'),
        description: t(
          'provisioning.getting-started.modal-description-public-access',
          'Set up public access to your Grafana instance to enable GitHub integration'
        ),
        steps: [
          {
            title: t('provisioning.getting-started.step-title-start-ngrok', 'Start ngrok for temporary public access'),
            description: t(
              'provisioning.getting-started.step-description-start-ngrok',
              'Run this command to create a secure tunnel to your local Grafana:'
            ),
            code: 'ngrok http 3000',
          },
          {
            title: t('provisioning.getting-started.step-title-copy-url', 'Copy your public URL'),
            description: t(
              'provisioning.getting-started.step-description-copy-url',
              'From the ngrok output, copy the https:// forwarding URL that looks like this:'
            ),
            code: ngrokExample,
            copyCode: false,
          },
          {
            title: t(
              'provisioning.getting-started.step-title-update-grafana-config',
              'Update your Grafana configuration'
            ),
            description: t(
              'provisioning.getting-started.step-description-update-grafana-config',
              'Add this to your custom.ini file, replacing the URL with your actual ngrok URL:'
            ),
            code: rootUrlExample,
          },
        ],
      };
    case 'required-features':
      return {
        title: t('provisioning.getting-started.modal-title-set-up-required-features', 'Set up required features'),
        description: t(
          'provisioning.getting-started.modal-description-required-features',
          'Enable required Grafana features for provisioning'
        ),
        steps: [
          {
            title: t(
              'provisioning.getting-started.step-title-enable-feature-toggles',
              'Enable Required Feature Toggles'
            ),
            description: t(
              'provisioning.getting-started.step-description-enable-feature-toggles',
              'Add these settings to your custom.ini file to enable necessary features:'
            ),
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

interface Props {
  items: Repository[];
}

export default function GettingStarted({ items }: Props) {
  const styles = useStyles2(getStyles);
  const settingsQuery = useGetFrontendSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const legacyStorage = settingsQuery.data?.legacyStorage;
  const hasItems = Boolean(settingsQuery.data?.items?.length);
  const { hasPublicAccess, hasImageRenderer, hasRequiredFeatures } = getConfigurationStatus();
  const [showInstructionsModal, setShowModal] = useState(false);
  const [setupType, setSetupType] = useState<SetupType>(null);
  const { t } = useTranslate();
  return (
    <>
      {legacyStorage && (
        <Alert
          severity="info"
          title={t(
            'provisioning.getting-started.title-setting-connection-could-cause-temporary-outage',
            'Setting up this connection could cause a temporary outage'
          )}
        >
          <Trans i18nKey="provisioning.getting-started.alert-temporary-outage">
            When you connect your whole instance, dashboards will be unavailable while running the migration. We
            recommend warning your users before starting the process.
          </Trans>
        </Alert>
      )}
      <Stack direction="column" gap={6} wrap="wrap">
        <Stack gap={10} alignItems="center">
          <FeaturesList
            repos={items}
            hasRequiredFeatures={hasRequiredFeatures}
            onSetupFeatures={() => {
              setSetupType('required-features');
              setShowModal(true);
            }}
          />
          <div className={styles.imageContainer}>
            <img src={provisioningSvg} className={styles.image} alt={'Grafana provisioning'} />
          </div>
        </Stack>
        {(!hasPublicAccess || !hasImageRenderer) && hasItems && (
          <EnhancedFeatures
            hasPublicAccess={hasPublicAccess}
            hasImageRenderer={hasImageRenderer}
            onSetupPublicAccess={() => {
              setSetupType('public-access');
              setShowModal(true);
            }}
          />
        )}
      </Stack>
      {showInstructionsModal && setupType && (
        <SetupModal
          {...getModalContent(setupType, t)}
          isOpen={showInstructionsModal}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    imageContainer: css({
      height: 350,
      display: `flex`,
      alignItems: `center`,
      justifyContent: `center`,
    }),
    image: css({
      borderRadius: theme.shape.radius.default,
      width: '100%',
      height: '100%',
    }),
  };
}
