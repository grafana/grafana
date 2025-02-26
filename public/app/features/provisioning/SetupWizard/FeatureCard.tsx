import { Button, Icon, Text, Box, Card } from '@grafana/ui';
import { FeatureInfo } from './types';

interface Props {
  feature: FeatureInfo;
  onSetup: () => void;
  showSetupButton?: boolean;
}

export const FeatureCard = ({ feature, onSetup, showSetupButton = true }: Props) => {
  const isConfigured = feature.steps.length === 0 || feature.steps.every((step) => step.fulfilled);

  return (
    <Card>
      <Card.Heading>
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
          {feature.title}
          {isConfigured ? (
            <Icon name="check-circle" color="green" />
          ) : (
            <Icon name="exclamation-triangle" color="orange" />
          )}
        </Box>
      </Card.Heading>
      <Card.Description>{feature.description}</Card.Description>
      {showSetupButton && (
        <Card.Actions>
          {!isConfigured && (
            <Button variant="primary" onClick={onSetup}>
              Setup Now
            </Button>
          )}
          {isConfigured && (
            <Box display="flex" alignItems="center">
              <Icon name="check-circle" color="green" style={{ marginRight: '8px' }} />
              <Text color="success">Configured</Text>
            </Box>
          )}
        </Card.Actions>
      )}
    </Card>
  );
};
