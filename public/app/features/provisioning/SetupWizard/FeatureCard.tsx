import { Button, Icon, Text, Box, Card, Stack } from '@grafana/ui';
import { FeatureInfo } from './types';
import { IconName } from '@grafana/ui';

interface Props {
  feature: FeatureInfo;
  onSetup: () => void;
  showSetupButton?: boolean;
}

export const FeatureCard = ({ feature, onSetup, showSetupButton = true }: Props) => {
  const isConfigured = feature.steps.length === 0 || feature.steps.every((step) => step.fulfilled);
  const iconName = (feature.icon || 'apps') as IconName;

  return (
    <Card style={{ maxWidth: '320px' }}>
      <Card.Heading>
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
          <Box display="flex" alignItems="center">
            <Text variant="h4">{feature.title}</Text>
          </Box>
          {isConfigured ? (
            <Icon name="check-circle" color="green" />
          ) : (
            <Icon name="exclamation-triangle" color="orange" />
          )}
        </Box>
      </Card.Heading>
      <Card.Description>
        <Stack direction="row" gap={2} alignItems="center">
          <Box display="flex" justifyContent="center" padding={2}>
            <Icon name={iconName} size="xxl" />
          </Box>
          <Text>{feature.description}</Text>
        </Stack>
      </Card.Description>

      {showSetupButton && (
        <Card.Actions>
          {!isConfigured && (
            <Button variant="primary" onClick={onSetup} icon="cog">
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
