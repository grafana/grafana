import { Stack, Text, Button, Box, LinkButton, Icon } from '@grafana/ui';
import { useNavigate } from 'react-router-dom-v5-compat';
import { CONNECT_URL, MIGRATE_URL } from '../constants';

interface FeatureItemProps {
  children: React.ReactNode;
}

const FeatureItem = ({ children }: FeatureItemProps) => (
  <Text variant="body">
    <Icon name="check" className="text-success" /> {children}
  </Text>
);

interface FeaturesListProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  hasRequiredFeatures: boolean;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({
  hasPublicAccess,
  hasImageRenderer,
  hasRequiredFeatures,
  onSetupFeatures,
}: FeaturesListProps) => {
  const navigate = useNavigate();

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

      {hasRequiredFeatures ? (
        <>
          <Stack direction="row" alignItems="center" gap={2}>
            <Button size="md" icon="plus" onClick={() => navigate(MIGRATE_URL)}>
              Migrate Grafana to repository
            </Button>
            <Text variant="body">or</Text>
            <LinkButton fill="outline" icon="plus" onClick={() => navigate(CONNECT_URL)}>
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
};
