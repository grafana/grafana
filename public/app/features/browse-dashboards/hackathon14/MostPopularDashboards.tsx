import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Spinner, useTheme2 } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { useGetPopularDashboards } from 'app/features/dashboard/api/popularResourcesApi';
import { useState } from 'react';

interface DashboardThumbnailProps {
  url: string;
  alt: string;
}

const DashboardThumbnail = ({ url, alt }: DashboardThumbnailProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const styles = useStyles2(getThumbnailStyles);

  return (
    <div className={styles.wrapper}>
      {imageLoading && !imageError && (
        <div className={styles.loading}>
          <Spinner />
          <Text variant="bodySmall" color="secondary">
            Rendering preview...
          </Text>
        </div>
      )}
      {imageError && (
        <div className={styles.error}>
          <Icon name="apps" size="xxl" />
          <Text variant="bodySmall" color="secondary">
            {!config.rendererAvailable ? 'Image renderer not installed' : 'Preview unavailable'}
          </Text>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className={styles.image}
        style={{ display: imageLoading || imageError ? 'none' : 'block' }}
        onLoad={() => {
          setImageLoading(false);
        }}
        onError={(e) => {
          console.error('Dashboard thumbnail failed to load:', url, e);
          setImageLoading(false);
          setImageError(true);
        }}
      />
    </div>
  );
};

export const MostPopularDashboards = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { data, isLoading, error } = useGetPopularDashboards({
    limit: 4,
    period: '30d',
  });

  // Debug logging
  console.log('Popular Dashboards API Response:', { data, isLoading, error });

  const handleResourceClick = (resource: any) => {
    // Navigate to the resource URL
    window.location.href = resource.url;
  };

  const getThumbnailUrl = (resource: any) => {
    if (resource.resourceType !== 'dashboard') {
      return null;
    }

    // Check if renderer is available
    if (!config.rendererAvailable) {
      console.warn('Image renderer plugin not available');
      return null;
    }

    // Generate render URL for full dashboard thumbnail with current theme
    const params = new URLSearchParams({
      width: '1920', // Larger width to capture full dashboard
      height: '1080', // Larger height for full content
      scale: '1',
      theme: theme.isDark ? 'dark' : 'light', // Match current theme
      kiosk: '1', // Full kiosk mode - completely hides sidebar and topbar
      timeout: '60', // Increased timeout for larger render
    });

    return `${config.appSubUrl}/render/d/${resource.uid}?${params.toString()}`;
  };

  return (
    <div>
      <Stack direction="row" gap={2} alignItems="center">
        <div>
          <div className={styles.headerTitle}>
            <Icon name="chart-line" size="lg" className={styles.headerIcon} style={{ marginRight: '4px' }} />
            <Text variant="h4">Suggested Dashboards</Text>
          </div>
          <Text variant="bodySmall" color="secondary">
            Trending in your organization
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
            {data.resources.map((resource) => {
              const thumbnailUrl = getThumbnailUrl(resource);

              return (
                <Card key={resource.uid} className={styles.clickableCard} onClick={() => handleResourceClick(resource)}>
                  <Stack direction="column" gap={0}>
                    {/* Dashboard Thumbnail */}
                    {thumbnailUrl && (
                      <div className={styles.thumbnailContainer}>
                        <DashboardThumbnail url={thumbnailUrl} alt={resource.title} />
                      </div>
                    )}

                    <div className={styles.cardContent}>
                      <Stack direction="row" gap={2} alignItems="center">
                        {/* <Icon 
                          name={getResourceIcon(resource.resourceType)} 
                          className={styles.resourceIcon} 
                        /> */}
                        <Text weight="medium">{resource.title}</Text>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Text variant="bodySmall" color="secondary">
                          Last visited
                        </Text>
                        <Text variant="bodySmall">{new Date(resource.lastVisited).toLocaleDateString()}</Text>
                      </Stack>
                    </div>
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
    </div>
  );
};

const getThumbnailStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    height: '160px', // Increased height for better preview
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 0, // Remove border radius since it's flush with card
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),

  loading: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
  }),

  error: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
  }),

  image: css({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }),
});

const getStyles = (theme: GrafanaTheme2) => ({
  headerIcon: css({
    color: '#6366f1',
    filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))',
  }),

  headerTitle: css({
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
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
    padding: 0,
    overflow: 'hidden',
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
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: 1,
    },

    '&:hover': {
      transform: 'translateY(-6px)',
      boxShadow: '0 12px 24px rgba(99, 102, 241, 0.3)',

      '&::before': {
        opacity: 0.8,
      },
    },
  }),

  thumbnailContainer: css({
    margin: 0, // Remove all margins
  }),

  cardContent: css({
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
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
