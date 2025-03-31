import { Stack, Text, Box, LinkButton, Icon } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';

interface FeatureItemProps {
  children: NonNullable<React.ReactNode>;
}

const FeatureItem = ({ children }: FeatureItemProps) => {
  // We use a stack here to ensure the icon and text are aligned correctly.
  return (
    <Stack direction="row" gap={1}>
      <Icon name="check" className="text-success" />
      <Text variant="body">{children}</Text>
    </Stack>
  );
};

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
      <Text variant="h2">Manage your dashboards with remote provisioning</Text>
      <FeatureItem>Manage dashboards as code and provision updates automatically</FeatureItem>
      <FeatureItem>
        Store dashboards in version-controlled storage for better organization and history tracking
      </FeatureItem>
      <FeatureItem>Migrate existing dashboards to storage for provisioning</FeatureItem>
      {hasPublicAccess && (
        <FeatureItem>
          Automatically provision and update your dashboards as soon as changes are pushed to your GitHub repository
        </FeatureItem>
      )}
      {hasImageRenderer && hasPublicAccess && (
        <FeatureItem>Visual previews in pull requests to review your changes before going live</FeatureItem>
      )}

      {false && (
        // We haven't gotten the design for this quite yet.
        <LinkButton fill="text" href="#" icon="external-link-alt">
          Learn more
        </LinkButton>
      )}

      {actions()}
    </Stack>
  );
};
