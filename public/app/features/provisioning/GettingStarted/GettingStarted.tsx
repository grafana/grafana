import { useNavigate } from 'react-router-dom-v5-compat';

import { LinkButton, Alert, Stack, Text, Button, Box, Icon, IconName } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from '../api';
import { CONNECT_URL, MIGRATE_URL } from '../constants';
import { css } from '@emotion/css';
import { getConfigurationStatus } from './utils';
import { useState } from 'react';
import { SetupModal } from './SetupModal';
import { feature_ini, ngrok_example, root_url_ini } from './types';

type SetupType = 'public-access' | 'required-features' | null;

interface FeatureItemProps {
  children: React.ReactNode;
}

const FeatureItem = ({ children }: FeatureItemProps) => (
  <Text variant="body">
    <Icon name="check" className="text-success" /> {children}
  </Text>
);

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  showBorder?: boolean;
}

interface IconCircleProps {
  icon: string;
  color: string;
  background: string;
}

const IconCircle = ({ icon, color, background }: IconCircleProps) => (
  <div
    className={css`
      background: ${background};
      border-radius: 50%;
      padding: 16px;
      width: fit-content;
    `}
  >
    <Icon name={icon as IconName} size="xxl" color={color} />
  </div>
);

const FeatureCard = ({ title, description, icon, action, showBorder = false }: FeatureCardProps) => (
  <Box width="25%" padding={2}>
    <div
      className={css`
        ${showBorder ? 'border-right: 1px solid rgba(204, 204, 220, 0.15);' : ''}
        height: 100%;
      `}
    >
      <Stack direction="column" gap={2}>
        {icon}
        <Text variant="h3">{title}</Text>
        <Text variant="body">{description}</Text>
        {action && <Box>{action}</Box>}
      </Stack>
    </div>
  </Box>
);

interface FeaturesListProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  hasRequiredFeatures: boolean;
  onMigrate: () => void;
  onConnect: () => void;
  onSetupFeatures: () => void;
}

const FeaturesList = ({
  hasPublicAccess,
  hasImageRenderer,
  hasRequiredFeatures,
  onMigrate,
  onConnect,
  onSetupFeatures,
}: FeaturesListProps) => (
  <Stack direction="column" gap={2}>
    <Text variant="h2">Provisioning as-code directly from Grafana</Text>
    <FeatureItem>
      Manage your dashboards as code and deploy them automatically from your GitHub repository or local storage
    </FeatureItem>
    <FeatureItem>
      Review, discuss, and approve dashboard changes with your team before they go live using GitHub pull requests
    </FeatureItem>
    <FeatureItem>
      Export your existing dashboards as code and store them in GitHub repositories for version control and
      collaboration
    </FeatureItem>
    {hasPublicAccess && (
      <FeatureItem>
        Automatically provision and update your dashboards as soon as changes are pushed to your GitHub repository
      </FeatureItem>
    )}
    {hasImageRenderer && hasPublicAccess && (
      <FeatureItem>Visual previews in pull requests to review your changes before going live</FeatureItem>
    )}

    <LinkButton fill="text" href="#" icon="external-link-alt">
      Learn more
    </LinkButton>

    {hasRequiredFeatures ? (
      <>
        <Stack direction="row" alignItems="center" gap={2}>
          <Button size="md" icon="plus" onClick={onMigrate}>
            Migrate Grafana to repository
          </Button>
          <Text variant="body">or</Text>
          <LinkButton fill="outline" icon="plus" onClick={onConnect}>
            Connect Grafana to repository
          </LinkButton>
        </Stack>
      </>
    ) : (
      <Box>
        <LinkButton fill="outline" onClick={onSetupFeatures}>
          Set up required features
        </LinkButton>
      </Box>
    )}
  </Stack>
);

interface EnhancedFeaturesProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  onSetupPublicAccess: () => void;
}

const EnhancedFeatures = ({ hasPublicAccess, hasImageRenderer, onSetupPublicAccess }: EnhancedFeaturesProps) => (
  <Box marginTop={2}>
    <Text variant="h2">Unlock enhanced functionality for GitHub</Text>
    <Box marginTop={4}>
      <Stack direction="row" gap={2}>
        <FeatureCard
          title="Instantenous provisioning"
          description="Automatically provision and update your dashboards as soon as changes are pushed to your GitHub repository"
          icon={<IconCircle icon="sync" color="primary" background="rgba(24, 121, 219, 0.12)" />}
          action={
            !hasPublicAccess && (
              <LinkButton fill="outline" onClick={onSetupPublicAccess}>
                Set up public access
              </LinkButton>
            )
          }
          showBorder
        />
        <FeatureCard
          title="Visual previews in pull requests"
          description="Review how your changes look like before going live in Grafana and directly in pull requests"
          icon={
            <Stack direction="row" gap={2}>
              <IconCircle icon="camera" color="orange" background="rgba(255, 120, 10, 0.12)" />
              <IconCircle icon="code-branch" color="purple" background="rgba(135, 73, 237, 0.12)" />
            </Stack>
          }
          action={
            !hasImageRenderer && (
              <LinkButton
                fill="outline"
                href="https://grafana.com/grafana/plugins/grafana-image-renderer/"
                icon="external-link-alt"
              >
                Set up image rendering
              </LinkButton>
            )
          }
        />
      </Stack>
    </Box>
  </Box>
);

export default function GettingStarted() {
  const settingsQuery = useGetFrontendSettingsQuery();
  const legacyStorage = settingsQuery.data?.legacyStorage;
  const navigate = useNavigate();

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
              code: ngrok_example,
              copyCode: false,
            },
            {
              title: 'Update your Grafana configuration',
              description: 'Add this to your custom.ini file, replacing the URL with your actual ngrok URL:',
              code: root_url_ini,
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
              code: feature_ini,
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
            hasPublicAccess={hasPublicAccess}
            hasImageRenderer={hasImageRenderer}
            hasRequiredFeatures={hasRequiredFeatures}
            onMigrate={async () => {
              await settingsQuery.refetch();
              navigate(MIGRATE_URL);
            }}
            onConnect={async () => {
              await settingsQuery.refetch();
              navigate(CONNECT_URL);
            }}
            onSetupFeatures={() => {
              setSetupType('required-features');
              setShowModal(true);
            }}
          />
        </Box>
        <Box width="50%">
          <div
            className={css`
              height: 100%;
              background: linear-gradient(to right, rgba(255, 179, 102, 0.6), rgba(255, 143, 143, 0.8));
              border-radius: 4px;
              padding: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
            `}
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
