import { Button, Icon, Text, Box, Card } from '@grafana/ui';
import { FeatureInfo } from './types';

interface Props {
  feature: FeatureInfo;
  onSetup: () => void;
  showSetupButton?: boolean;
}

export const FeatureCard = ({ feature, onSetup, showSetupButton = true }: Props) => {
  // Calculate if the feature is fully configured
  const isConfigured = feature.steps.length > 0 && feature.steps.every((step) => step.fulfilled);

  return (
    <Card>
      <Card.Heading>{feature.title}</Card.Heading>
      <Card.Description>{feature.description}</Card.Description>
      <Card.Actions>
        {showSetupButton && !isConfigured && (
          <Button variant="primary" onClick={onSetup}>
            Setup Now
          </Button>
        )}
        {isConfigured && (
          <Box display="flex" alignItems="center">
            <Icon name="check-circle" color="success" />
            <Text color="success">Configured</Text>
          </Box>
        )}
      </Card.Actions>
    </Card>
  );
};
