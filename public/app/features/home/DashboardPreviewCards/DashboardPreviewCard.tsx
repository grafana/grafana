import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { type DashboardPreviewCardData } from './dashboardPreviewData';

interface Props {
  card: DashboardPreviewCardData;
}

export function DashboardPreviewCard({ card }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <a href={card.href} className={styles.card}>
      <div className={styles.thumbnailContainer}>
        <img src={card.imagePath} alt={card.title} className={styles.thumbnail} />
      </div>
      <div className={styles.content}>
        <Text element="h3" weight="medium" truncate>
          {card.title}
        </Text>
        <Text color="secondary" variant="bodySmall" truncate>
          {card.description}
        </Text>
      </div>
    </a>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      textDecoration: 'none',
      color: 'inherit',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['border-color', 'box-shadow'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:hover': {
        borderColor: theme.colors.border.strong,
        boxShadow: theme.shadows.z2,
      },
    }),
    thumbnailContainer: css({
      width: '100%',
      aspectRatio: '16/9',
      overflow: 'hidden',
      backgroundColor: theme.colors.background.canvas,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    thumbnail: css({
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1.5),
    }),
  };
}
