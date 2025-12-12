import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, IconButton, useStyles2 } from '@grafana/ui';

export interface SqlExpressionCardProps {
  name: string;
  description: string;
  imageUrl?: string;
  onClick: () => void;
  testId?: string;
  isDisabled?: boolean;
  disabledTooltip?: string;
}

export function SqlExpressionCard({
  name,
  description,
  imageUrl,
  onClick,
  testId,
  isDisabled,
  disabledTooltip,
}: SqlExpressionCardProps) {
  const styles = useStyles2(getSqlExpressionCardStyles);
  const cardClasses = isDisabled ? cx(styles.card, styles.cardDisabled) : styles.card;

  return (
    <Card className={cardClasses} data-testid={testId} onClick={onClick} noMargin>
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
        {isDisabled && disabledTooltip && (
          <IconButton className={styles.cardApplicableInfo} name="info-circle" tooltip={disabledTooltip} />
        )}
      </Card.Description>
    </Card>
  );
}

function getSqlExpressionCardStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      gridTemplateRows: 'min-content 0 1fr 0',
      marginBottom: 0,
    }),
    heading: css({
      fontWeight: 400,
      '> button': {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
      },
    }),
    titleRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'nowrap',
      width: '100%',
    }),
    description: css({
      fontSize: theme.typography.bodySmall.fontSize,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }),
    image: css({
      display: 'block',
      maxWidth: '100%',
      marginTop: theme.spacing(2),
    }),
    cardDisabled: css({
      backgroundColor: theme.colors.action.disabledBackground,
      img: {
        filter: 'grayscale(100%)',
        opacity: 0.33,
      },
    }),
    cardApplicableInfo: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
  };
}
