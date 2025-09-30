import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Grid } from '@grafana/ui';
import { useGetRecentDashboardsAndFolders } from 'app/features/dashboard/api/popularResourcesApi';

export const RecentVisited = () => {
  const styles = useStyles2(getStyles);
  const { data, isLoading, error } = useGetRecentDashboardsAndFolders({
    limit: 4,
    period: '30d',
  });

  const handleResourceClick = (resource: any) => {
    // Navigate to the resource URL
    window.location.href = resource.url;
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'dashboard':
        return 'apps';
      case 'folder':
        return 'folder';
      case 'alert':
        return 'bell';
      default:
        return 'question-circle';
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString();
  };

  return (
    <div>
      <Stack direction="row" gap={2} alignItems="center">
        <div>
          <div className={styles.headerTitle}>
            <Icon name="history" size="lg" className={styles.headerIcon} style={{ marginRight: '4px' }} />
            <Text variant="h4">Recently Visited</Text>
          </div>
          <Text variant="bodySmall" color="secondary">
            Dashboards & Folders you've explored
          </Text>
        </div>
      </Stack>

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Spinner />
            <Text>Loading...</Text>
          </div>
        )}

        {error && (
          <Card className={styles.errorCard}>
            <Text color="error">Failed to load recent resources</Text>
          </Card>
        )}

        {data && data.resources?.length > 0 && (
          <div className={styles.listContainer}>
            <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
              {data.resources.map((resource) => (
                <Card key={resource.uid} className={styles.resourceCard} onClick={() => handleResourceClick(resource)}>
                  <div className={styles.cardContent}>
                    <Icon name={getResourceIcon(resource.resourceType)} size="xl" className={styles.resourceIcon} />
                    <div className={styles.contentWrapper}>
                      <div className={styles.titleRow}>
                        <div className={styles.resourceTitle}>
                          <Text weight="medium">{resource.title}</Text>
                        </div>
                        <div className={styles.typeBadge}>
                          <Text variant="bodySmall">{resource.resourceType}</Text>
                        </div>
                      </div>
                      <Text variant="bodySmall" color="secondary">
                        {getRelativeTime(resource.lastVisited)}
                      </Text>
                    </div>
                  </div>
                </Card>
              ))}
            </Grid>
          </div>
        )}

        {data && data.resources?.length === 0 && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No recently visited resources found</Text>
          </Card>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerIcon: css({
    color: '#8b5cf6',
    filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))',
  }),

  headerTitle: css({
    background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }),

  container: css({
    marginTop: theme.spacing(3),
  }),

  loadingContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
  }),

  listContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),

  resourceCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    border: '2px solid transparent',
    padding: theme.spacing(2),

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(139, 92, 246, 0.18)',

      '&::before': {
        opacity: 0.45,
      },
    },
  }),

  cardContent: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  }),

  contentWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),

  resourceIcon: css({
    // color: '#8b5cf6',
    flexShrink: 0,
  }),

  titleRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),

  resourceTitle: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  typeBadge: css({
    padding: theme.spacing(0.25, 1),
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: theme.shape.radius.pill,
    border: '1px solid rgba(139, 92, 246, 0.3)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),

  emptyCard: css({
    textAlign: 'center',
    padding: theme.spacing(6),
    background: `linear-gradient(135deg, ${theme.colors.background.canvas} 0%, ${theme.colors.background.secondary} 100%)`,
  }),

  emptyIllustration: css({
    position: 'relative',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),

  iconStack: css({
    position: 'relative',
    width: '120px',
    height: '120px',
  }),

  iconDashboard: css({
    position: 'absolute',
    top: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    color: theme.colors.primary.main,
    opacity: 0.3,
    animation: 'float 3s ease-in-out infinite',
    '@keyframes float': {
      '0%, 100%': {
        transform: 'translateX(-50%) translateY(0px)',
      },
      '50%': {
        transform: 'translateX(-50%) translateY(-10px)',
      },
    },
  }),

  iconFolder: css({
    position: 'absolute',
    top: '30px',
    left: '20%',
    color: theme.colors.warning.main,
    opacity: 0.5,
    animation: 'float 3s ease-in-out infinite 0.5s',
  }),

  iconCompass: css({
    position: 'absolute',
    top: '50px',
    right: '20%',
    color: theme.colors.success.main,
    opacity: 0.6,
    animation: 'float 3s ease-in-out infinite 1s',
  }),

  tipCard: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    maxWidth: '400px',
  }),

  tipIcon: css({
    color: theme.colors.warning.main,
    fontSize: theme.typography.h5.fontSize,
  }),

  actionLink: css({
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    textDecoration: 'none',
    color: theme.colors.text.primary,
    transition: 'all 0.2s ease',

    '&:hover': {
      backgroundColor: theme.colors.background.canvas,
      borderColor: theme.colors.primary.border,
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.z2,
    },
  }),

  errorCard: css({
    padding: theme.spacing(2),
  }),
});
