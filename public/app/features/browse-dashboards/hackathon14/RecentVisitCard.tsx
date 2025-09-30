import { css } from '@emotion/css';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Card, Icon, Text, useStyles2 } from '@grafana/ui';

type ResourceType = 'dashboard' | 'folder' | 'alert';

interface RecentVisitCardProps {
  type: ResourceType;
  title: string;
  subtitle: string;
  onClick?: () => void;
}

export const RecentVisitCard = ({ type, title, subtitle, onClick }: RecentVisitCardProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Card className={styles.resourceCard} onClick={onClick}>
      <div className={styles.cardContent}>
        {/* Left: Icon */}
        <Icon name={getResourceIcon(type)} size="xl" className={styles.resourceIcon} />
        
        {/* Right: Content */}
        <div className={styles.contentWrapper}>
          <div className={styles.titleRow}>
            <div className={styles.resourceTitle}>
              <Text weight="medium">{title}</Text>
            </div>
            <div className={styles.typeBadge}>
              <Text variant="bodySmall">{type}</Text>
            </div>
          </div>
          <Text variant="bodySmall" color="secondary">
            {subtitle}
          </Text>
        </div>
      </div>
    </Card>
  );
};

function getResourceIcon(type: ResourceType): IconName {
  switch (type) {
    case 'dashboard':
      return 'apps';
    case 'folder':
      return 'folder';
    case 'alert':
      return 'bell';
    default:
      return 'question-circle';
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  resourceCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: theme.colors.background.secondary,
    position: 'relative',
    overflow: 'hidden',
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
    },

    '&:hover': {
      background: theme.colors.background.secondary,
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(255, 120, 10, 0.18)',
      
      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  cardContent: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5),
  }),

  resourceIcon: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
  }),

  contentWrapper: css({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),

  titleRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),

  resourceTitle: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  typeBadge: css({
    flexShrink: 0,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.emphasize(theme.colors.background.secondary, 0.15),
    color: theme.colors.primary.text,
    textTransform: 'capitalize',
  }),
});
