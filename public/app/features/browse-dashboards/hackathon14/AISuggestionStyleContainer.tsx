import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, useStyles2, Text, Button } from '@grafana/ui';

export const AISuggestionStyleContainer = ({
  hasRecommendations,
  handleRefresh,
  children,
}: {
  hasRecommendations: boolean;
  handleRefresh?: () => void;
  children: React.ReactNode;
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
        <Stack direction="row" gap={2} alignItems="center">
          <Icon name="ai" size="lg" className={styles.titleIcon} />
          <div>
            <div className={styles.title}>
              <Text variant="h5">AI Recommended Based on Your Search</Text>
            </div>
            <Text variant="bodySmall" color="secondary">
              Smart suggestions powered by <span className={styles.highlight}>LLM analysis</span>
            </Text>
          </div>
        </Stack>
        {hasRecommendations && (
          <Button
            size="sm"
            variant="secondary"
            icon="sync"
            onClick={() => handleRefresh?.()}
            className={styles.refreshButton}
          >
            Refresh
          </Button>
        )}
      </Stack>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(4),
    padding: theme.spacing(3),
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
    borderRadius: theme.shape.radius.default,
    border: '1px solid rgba(217, 70, 239, 0.2)',
  }),

  titleIcon: css({
    color: '#d946ef',
    filter: 'drop-shadow(0 0 8px rgba(217, 70, 239, 0.5))',
  }),

  title: css({
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
  }),

  highlight: css({
    color: '#d946ef',
    fontWeight: 500,
  }),

  refreshButton: css({
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.1), rgba(139, 92, 246, 0.1))',
    border: '2px solid rgba(217, 70, 239, 0.3)',
    transition: 'all 0.3s ease',

    '&:hover': {
      background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.2), rgba(139, 92, 246, 0.2))',
      border: '2px solid rgba(217, 70, 239, 0.6)',
      transform: 'translateY(-2px)',
      boxShadow: '0 0 20px rgba(217, 70, 239, 0.4)',
    },
  }),

  content: css({
    marginTop: theme.spacing(2),
  }),

  loadingCard: css({
    padding: theme.spacing(4),
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    textAlign: 'center',
  }),

  errorCard: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.error.transparent,
  }),

  recommendationCard: css({
    padding: theme.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    background: theme.colors.background.primary,
    border: '2px solid transparent',
    borderRadius: theme.shape.radius.default,

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #d946ef, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0.3,
      transition: 'opacity 0.3s ease',
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(217, 70, 239, 0.25)',

      '&::before': {
        opacity: 0.6,
      },
    },
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),

  dashboardIcon: css({
    color: '#d946ef',
    flexShrink: 0,
    transition: 'filter 0.3s ease',
  }),

  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  relevanceBadge: css({
    padding: theme.spacing(0.5, 1),
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    borderRadius: theme.shape.radius.pill,
    whiteSpace: 'nowrap',
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  }),

  popularityIcon: css({
    color: '#8b5cf6',
    flexShrink: 0,
    transition: 'filter 0.3s ease',
  }),

  emptyCard: css({
    padding: theme.spacing(2),
    textAlign: 'center',
  }),
});
