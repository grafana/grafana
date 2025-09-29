import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid } from '@grafana/ui';
import {
  useGetPopularDashboards,
  useGetPopularResourcesByType,
  useGetPopularResourcesQuery,
} from 'app/features/dashboard/api/popularResourcesApi';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';

export const MostPopularDashboards = () => {
  const styles = useStyles2(getStyles);
  const [searchState, stateManager] = useSearchStateManager();
  const { data, isLoading } = useGetPopularDashboards({
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
        <Text variant="h4">Suggested Dashboards</Text>
      </Stack>

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Text>Loading...</Text>
          </div>
        )}
        
        {data && data.resources.length > 0 && (
          <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            {data.resources.map((resource) => (
              <Card 
                key={resource.uid} 
                className={styles.clickableCard} 
                onClick={() => handleResourceClick(resource)}
              >
                <Stack direction="column" gap={2}>
                  <Stack direction="row" gap={2} alignItems="center">
                    <Icon 
                      name={getResourceIcon(resource.resourceType)} 
                      className={styles.resourceIcon} 
                    />
                    <Text weight="medium">{resource.title}</Text>
                    {/* <Stack direction="column">
                      <Text weight="medium" truncate>{resource.title}</Text>
                      <Text variant="bodySmall" color="secondary">
                        {resource.resourceType} • {resource.visitCount} visits
                      </Text>
                    </Stack> */}
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Text variant="bodySmall" color="secondary">
                      Last visited
                    </Text>
                    <Text variant="bodySmall">
                      {new Date(resource.lastVisited).toLocaleDateString()}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Grid>
        )}
        
        {/* TODO: show default dashboards list */}
        {data && data.resources.length === 0 && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">
              No data.
            </Text>
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
    justifyContent: 'center',
    padding: theme.spacing(4),
  }),

  clickableCard: css({

  }),

  resourceIcon: css({
    color: theme.colors.primary.main,
    fontSize: '20px',
    flexShrink: 0,
  }),

  emptyCard: css({
    textAlign: 'center',
    padding: theme.spacing(4),
  }),
});
