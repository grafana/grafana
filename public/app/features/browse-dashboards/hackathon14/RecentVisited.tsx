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

        {data && data.resources.length > 0 && (
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

        {data && data.resources.length === 0 && (
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
    padding: theme.spacing(4),
  }),

  errorCard: css({
    padding: theme.spacing(2),
  }),
});
