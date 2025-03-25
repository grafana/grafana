import { Stack, Text, Box, LinkButton, Icon } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';

interface FeatureItemProps {
  children: React.ReactNode;
}

const FeatureItem = ({ children }: FeatureItemProps) => (
  <Text variant="body">
    <Icon name="check" className="text-success" /> {children}
  </Text>
);

interface FeaturesListProps {
  repos?: Repository[];
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  hasRequiredFeatures: boolean;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({
  repos,
  hasPublicAccess,
  hasImageRenderer,
  hasRequiredFeatures,
  onSetupFeatures,
}: FeaturesListProps) => {
  const actions = () => {
    if (!hasRequiredFeatures) {
      return (
        <Box>
          <LinkButton fill="outline" onClick={onSetupFeatures}>
            Set up required feature toggles
          </LinkButton>
        </Box>
      );
    }

    return (
      <Stack direction="row" alignItems="center" gap={2}>
        <ConnectRepositoryButton items={repos} />
      </Stack>
    );
  };

  return (
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

      {actions()}
    </Stack>
  );
};
