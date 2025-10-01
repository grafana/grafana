import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Box, TextLink } from '@grafana/ui';
import { useGetPopularFolders } from 'app/features/dashboard/api/popularResourcesApi';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';

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
    <Box marginTop={2}>
      <BrowsingSectionTitle
        title="Most Popular Folders"
        subtitle="Based on your activity"
        icon="fire"
        actions={
          <TextLink href="/dashboards/hackathon14/view-all-folders" color="secondary" className={styles.viewAllLink}>
            View All
          </TextLink>
        }
      />

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Text variant="bodySmall">Loading...</Text>
          </div>
        )}

        {data && data.resources?.length > 0 && (
          <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            {data.resources.map((resource) => {
              const title = resource.title?.length > 20 ? `${resource.title.slice(0, 20)}…` : resource.title;
              return (
                <Card key={resource.uid} className={styles.clickableCard} onClick={() => handleResourceClick(resource)}>
                  <Stack direction="column" gap={1}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Icon name="folder" size="lg" className={styles.folderIcon} />
                      <Text weight="medium" className={styles.folderTitle} title={resource.title}>
                        {title}
                      </Text>
                    </Stack>

                    <Text variant="bodySmall" color="secondary" className={styles.metaText}>
                      Last visited: {resource.lastVisited ? new Date(resource.lastVisited).toLocaleDateString() : 'N/A'}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </Grid>
        )}

        {/* TODO: show default dashboards list */}
        {data && data.resources?.length === 0 && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No data.</Text>
          </Card>
        )}
      </div>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerIcon: css({
    color: theme.colors.text.secondary,
  }),

  headerTitle: css({
    color: theme.colors.text.primary,
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

  folderTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  }),

  metaText: css({
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),

  emptyCard: css({
    textAlign: 'center',
    padding: theme.spacing(4),
  }),

  viewAllLink: css({
    color: theme.colors.text.secondary,
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
      textDecoration: 'underline',
    },
  }),
});
