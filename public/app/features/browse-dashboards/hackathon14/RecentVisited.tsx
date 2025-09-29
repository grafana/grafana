import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon } from '@grafana/ui';
import { useGetPopularDashboards, useGetPopularResourcesByType, useGetPopularResourcesQuery } from 'app/features/dashboard/api/popularResourcesApi';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';

export const RecentVisited = () => {
  const styles = useStyles2(getStyles);
  const [searchState, stateManager] = useSearchStateManager();
  const { data, isLoading } = useGetPopularResourcesQuery({
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
        <Text variant="h4">Suggested for you</Text>{' '}
        <Text variant="bodySmall" color="secondary">
          (based on your visited resources)
        </Text>
      </Stack>

      <Stack gap={2}>
        {isLoading && <Text>Loading...</Text>}
        {data &&
          data.resources.map((resource) => (
            <Card 
              key={resource.uid}
              className={styles.clickableCard}
              onClick={() => handleResourceClick(resource)}
            >
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" gap={2} alignItems="center">
                  <Icon 
                    name={getResourceIcon(resource.resourceType)} 
                    className={styles.resourceIcon}
                  />
                  <Stack direction="column" gap={0}>
                    <Text weight="medium">{resource.title}</Text>
                    <Text variant="bodySmall" color="secondary">
                      {resource.resourceType} • {resource.visitCount} visits
                    </Text>
                  </Stack>
                </Stack>
                <Stack direction="column" alignItems="flex-end">
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
        
        {data && data.resources.length === 0 && (
          <Card>
            <Text color="secondary">
              No recent activity. Start browsing dashboards to see suggestions here!
            </Text>
          </Card>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  clickableCard: css({
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.z2,
    },
    
    '&:active': {
      transform: 'translateY(0px)',
    },
  }),

  resourceIcon: css({
    color: theme.colors.primary.main,
    fontSize: '18px',
  }),
});
