import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Spinner, useTheme2 } from '@grafana/ui';
import { config } from '@grafana/runtime';
import {
  useGetPopularDashboards,
} from 'app/features/dashboard/api/popularResourcesApi';
import { useState } from 'react';

interface DashboardThumbnailProps {
  url: string;
  alt: string;
}

const DashboardThumbnail = ({ url, alt }: DashboardThumbnailProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const styles = useStyles2(getThumbnailStyles);

  // Debug: Log the render URL
  console.log('Dashboard render URL:', url);

  return (
    <div className={styles.wrapper}>
      {imageLoading && !imageError && (
        <div className={styles.loading}>
          <Spinner />
          <Text variant="bodySmall" color="secondary">Rendering preview...</Text>
        </div>
      )}
      {imageError && (
        <div className={styles.error}>
          <Icon name="apps" size="xxl" />
          <Text variant="bodySmall" color="secondary">
            {!config.rendererAvailable 
              ? 'Image renderer not installed' 
              : 'Preview unavailable'}
          </Text>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className={styles.image}
        style={{ display: imageLoading || imageError ? 'none' : 'block' }}
        onLoad={() => {
          console.log('Dashboard thumbnail loaded:', url);
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
      width: '1920',  // Larger width to capture full dashboard
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
      <Stack direction="row" gap={1} alignItems="baseline">
        <Text variant="h4">Suggested Dashboards</Text><Text variant="bodySmall" color="secondary">(Most Visited)</Text>
      </Stack>

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Text>Loading...</Text>
          </div>
        )}
        
        {data && data.resources.length > 0 && (
          <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            {data.resources.map((resource) => {
              const thumbnailUrl = getThumbnailUrl(resource);
              
              return (
                <Card 
                  key={resource.uid} 
                  className={styles.clickableCard} 
                  onClick={() => handleResourceClick(resource)}
                >
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
                        <Text variant="bodySmall">
                          {new Date(resource.lastVisited).toLocaleDateString()}
                        </Text>
                      </Stack>
                    </div>
                  </Stack>
                </Card>
              );
            })}
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
    transition: 'transform 0.2s, box-shadow 0.2s',
    padding: 0, // Remove all padding
    overflow: 'hidden', // Ensure content doesn't overflow
    
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.z3,
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
