import { Card, Text, useStyles2 } from '@grafana/ui';

import { getCardStyles } from './getCardStyles';

export interface SqlExpressionCardProps {
  name: string;
  description: string;
  imageUrl?: string;
  onClick: () => void;
  testId?: string;
}

export function SqlExpressionCard({ name, description, imageUrl, onClick, testId }: SqlExpressionCardProps) {
  const styles = useStyles2(getCardStyles);

  return (
    <Card className={styles.baseCard} data-testid={testId} onClick={onClick} noMargin>
      <Card.Heading>{name}</Card.Heading>
      <Card.Description>
        <Text variant="bodySmall">{description}</Text>
        {imageUrl && <img className={styles.image} src={imageUrl} alt={name} />}
      </Card.Description>
    </Card>
  );
}
