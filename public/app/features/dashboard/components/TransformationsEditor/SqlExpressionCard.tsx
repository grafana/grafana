import { t } from '@grafana/i18n';
import { Badge, Card, Stack, Text, useStyles2 } from '@grafana/ui';

import { getCardStyles } from './getCardStyles';

export interface SqlExpressionCardProps {
  name: string;
  description: string;
  onClick: () => void;
  imageUrl?: string;
  testId?: string;
  fullWidth?: boolean;
  showNewBadge?: boolean;
}

export function SqlExpressionCard({
  name,
  description,
  onClick,
  imageUrl,
  testId,
  fullWidth = false,
  showNewBadge = false,
}: SqlExpressionCardProps) {
  const styles = useStyles2(getCardStyles, fullWidth);

  return (
    <Card className={styles.baseCard} data-testid={testId} onClick={onClick} noMargin>
      <Card.Heading>
        <Stack direction="row" gap={0.5} alignItems="center">
          {showNewBadge && (
            <Badge color="brand" text={t('dashboard-scene.empty-transformations-message.new-badge', 'New')} />
          )}
          {name}
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Text variant="bodySmall">{description}</Text>
        {imageUrl && <img className={styles.image} src={imageUrl} alt={name} />}
      </Card.Description>
    </Card>
  );
}
