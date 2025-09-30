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

  return (
    <div>
      <Stack direction="row" gap={1} alignItems="baseline">
        <Text variant="h4">Recently Visited</Text>
        <Text variant="bodySmall" color="secondary">
          (Dashboards & Folders)
        </Text>
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
            <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
              {data.resources.map((resource) => (
                <Card key={resource.uid} className={styles.resourceCard} onClick={() => handleResourceClick(resource)}>
                  <Stack direction="column" gap={2} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" gap={2} alignItems="center">
                      <Icon name={getResourceIcon(resource.resourceType)} size="lg" />
                      <div>
                        <Text weight="medium">{resource.title}</Text>
                        <Text variant="bodySmall" color="secondary">
                          {resource.resourceType}
                        </Text>
                      </div>
                    </Stack>
                    <Text variant="bodySmall" color="secondary">
                      {new Date(resource.lastVisited).toLocaleString()}
                    </Text>
                  </Stack>
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
  container: css({
    marginTop: theme.spacing(2),
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
    transition: 'transform 0.2s, box-shadow 0.2s',

    '&:hover': {
      transform: 'translateX(4px)',
      boxShadow: theme.shadows.z2,
    },
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
