import { Button, Icon, Text, Card, Stack, Box } from '@grafana/ui';
import { Feature } from './types';
import { IconName } from '@grafana/ui';

interface Props {
  feature: Feature;
  onSetup: () => void;
  showSetupButton?: boolean;
}

export const FeatureCard = ({ feature, onSetup, showSetupButton = true }: Props) => {
  const isConfigured = feature.isConfigured;
  const iconName = (feature.icon || 'apps') as IconName;

  return (
    <Card>
      <Card.Heading>
        <Stack justifyContent="center" width="100%">
          <Text element="h2" variant="h2">
            {feature.title}
          </Text>
        </Stack>
      </Card.Heading>

      <Card.Description>
        <Stack direction="column" gap={2} justifyContent="center" alignItems="center">
          <Icon name={iconName} size="xxxl" />
          <Text color="secondary">{feature.description}</Text>
        </Stack>
      </Card.Description>

      {showSetupButton && !isConfigured && (
        <Card.Actions>
          <Stack justifyContent="center" width="100%">
            <Button variant="primary" onClick={onSetup}>
              Set Up Now
            </Button>
          </Stack>
        </Card.Actions>
      )}
      <Card.SecondaryActions>
        {isConfigured ? (
          <Icon name="check-circle" color="green" size="lg" />
        ) : (
          <Icon name="exclamation-triangle" size="lg" color={feature.additional ? 'orange' : 'red'} />
        )}
      </Card.SecondaryActions>
    </Card>
  );
};
