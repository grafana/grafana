import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid } from '@grafana/ui';
import {
  useGetPopularFolders,
} from 'app/features/dashboard/api/popularResourcesApi';

export const MostPopularFolders = () => {
  const styles = useStyles2(getStyles);
  const { data, isLoading } = useGetPopularFolders({
    limit: 4,
    period: '30d',
  });

  const handleResourceClick = (resource: any) => {
    // Navigate to the resource URL
    window.location.href = resource.url;
  };

  return (
    <div>
      <Stack direction="row" gap={1} alignItems="baseline">
        <Text variant="h4">Suggested Folders</Text>
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
                <Stack direction="row" gap={2} alignItems="center">
                  <Icon name="folder" size="xl" />
                  <Text weight="medium">{resource.title}</Text>
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
    cursor: 'pointer',
  }),

  emptyCard: css({
    textAlign: 'center',
    padding: theme.spacing(4),
  }),
});
