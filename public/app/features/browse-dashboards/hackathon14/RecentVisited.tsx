import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Grid } from '@grafana/ui';
import { useGetRecentDashboardsAndFolders } from 'app/features/dashboard/api/popularResourcesApi';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';
import { RecentVisitCard } from './RecentVisitCard';

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

  return (
    <div>
      <BrowsingSectionTitle title="Recently Visited" subtitle="Dashboards & Folders you've explored" icon="history" />

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
                <RecentVisitCard
                  key={resource.uid}
                  type={resource.resourceType as 'dashboard' | 'folder' | 'alert'}
                  title={resource.title}
                  subtitle={getRelativeTime(resource.lastVisited)}
                  onClick={() => handleResourceClick(resource)}
                />
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

export const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  }
  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  }
  if (diffInSeconds < 604800) {
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }

  return date.toLocaleDateString();
};
