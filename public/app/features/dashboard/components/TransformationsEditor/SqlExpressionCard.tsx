import { Card, useStyles2 } from '@grafana/ui';

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
    <Card className={styles.newCard} data-testid={testId} onClick={onClick} noMargin>
      <Card.Heading className={styles.heading}>
        <div className={styles.titleRow}>
          <span>{name}</span>
        </div>
      </Card.Heading>
      <Card.Description className={styles.description}>
        <span>{description}</span>
        {imageUrl && (
          <span>
            <img className={styles.image} src={imageUrl} alt={name} />
          </span>
        )}
      </Card.Description>
    </Card>
  );
}
