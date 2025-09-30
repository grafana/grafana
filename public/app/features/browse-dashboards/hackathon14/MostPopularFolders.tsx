import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid } from '@grafana/ui';
import { useGetPopularFolders } from 'app/features/dashboard/api/popularResourcesApi';

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
      <Stack direction="row" gap={2} alignItems="center">
        <div>
          <div className={styles.headerTitle}>
            <Icon name="folder-open" size="lg" className={styles.headerIcon} style={{ marginRight: '4px' }} />
            <Text variant="h4">Suggested Folders</Text>
          </div>
          <Text variant="bodySmall" color="secondary">
            Based on your most active data sources
          </Text>
        </div>
      </Stack>

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Text>Loading...</Text>
          </div>
        )}

        {data && data.resources?.length > 0 && (
          <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            {data.resources.map((resource) => (
              <Card key={resource.uid} className={styles.clickableCard} onClick={() => handleResourceClick(resource)}>
                <Stack direction="row" gap={2} alignItems="flex-start">
                  <Icon name="folder" size="xl" className={styles.folderIcon} />
                  <Text weight="medium">{resource.title}</Text>
                </Stack>
              </Card>
            ))}
          </Grid>
        )}

        {/* TODO: show default dashboards list */}
        {data && data.resources?.length === 0 && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No data.</Text>
          </Card>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerIcon: css({
    color: '#ec4899',
    filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.4))',
  }),

  headerTitle: css({
    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }),

  folderIcon: css({
    marginTop: theme.spacing(0.5),
    flexShrink: 0,
  }),

  container: css({
    marginTop: theme.spacing(3),
  }),

  loadingContainer: css({
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  }),

  clickableCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    border: '2px solid transparent',

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
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(255, 120, 10, 0.12)',

      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  emptyCard: css({
    textAlign: 'center',
    padding: theme.spacing(4),
  }),
});
