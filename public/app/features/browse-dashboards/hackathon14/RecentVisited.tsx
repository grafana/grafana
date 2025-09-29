import { Card, Stack, Text } from '@grafana/ui';
import { useGetPopularDashboards, useGetPopularResourcesByType, useGetPopularResourcesQuery } from 'app/features/dashboard/api/popularResourcesApi';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';

export const RecentVisited = () => {
  const [searchState, stateManager] = useSearchStateManager();
  const { data, isLoading } = useGetPopularResourcesQuery({
    limit: 4,
    period: '30d',
  });

  return (
    <div>
      <Stack direction="row" gap={1} alignItems="baseline">
        <Text variant="h4">Suggested for you</Text>{' '}
        <Text variant="bodySmall" color="secondary">
          (based on your visited dashboards)
        </Text>
      </Stack>

      <Stack>
        {isLoading && <Text>Loading...</Text>}
        {data &&
          data.resources.map((resource) => (
            <Card noMargin key={resource.uid}>
              {resource.title}
            </Card>
          ))}
      </Stack>
    </div>
  );
};
