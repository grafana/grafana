import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Card, Stack, Text, useStyles2, Icon, Grid, Spinner, useTheme2, ButtonGroup, Box, TextLink, LinkButton, ToolbarButton } from '@grafana/ui';
import { useGetPopularDashboards } from 'app/features/dashboard/api/popularResourcesApi';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';

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
  const [viewMode, setViewMode] = useState<'thumbnail' | 'list'>('thumbnail');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [enrichedDashboards, setEnrichedDashboards] = useState<any[]>([]);
  const { data, isLoading } = useGetPopularDashboards({
    limit: 10,
    period: '30d',
  });

  // Enrich dashboards with folder names and tags
  useEffect(() => {
    const enrichDashboards = async () => {
      if (!data?.resources) {
        return;
      }

      try {
        const searcher = getGrafanaSearcher();
        
        // Fetch all dashboards to get their details
        const result = await searcher.search({
          kind: ['dashboard'],
          query: '*',
          limit: 1000,
        });

        // Get location info for folder names
        const locationInfo = await searcher.getLocationInfo();
        
        // Create a map of UID -> dashboard details for quick lookup
        const dashboardMap = new Map();
        (result.view || []).forEach((dashboard: any) => {
          dashboardMap.set(dashboard.uid, dashboard);
        });

        // Enrich our popular dashboards with the additional details
        const enrichedData = data.resources.map((resource) => {
          const dashboardDetail = dashboardMap.get(resource.uid);
          const folderUid = dashboardDetail?.location;
          const folderInfo = folderUid ? locationInfo[folderUid] : null;

          return {
            ...resource,
            tags: dashboardDetail?.tags || [],
            folderName: folderInfo?.name || (folderUid === 'general' ? 'General' : folderUid || 'Unknown'),
          };
        });

        setEnrichedDashboards(enrichedData);
      } catch (error) {
        console.error('Failed to enrich dashboards:', error);
        // Fallback to showing resources without enrichment
        setEnrichedDashboards(data.resources.map(r => ({ ...r, tags: [], folderName: 'General' })));
      }
    };

    enrichDashboards();
  }, [data?.resources]);

  const handleResourceClick = (resource: any) => {
    // Navigate to the resource URL
    window.location.href = resource.url;
  };

  const toggleRowExpansion = (uid: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) {
        newSet.delete(uid);
      } else {
        newSet.add(uid);
      }
      return newSet;
    });
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
    <Box marginTop={2}>
      <BrowsingSectionTitle
          title="Most Popular Dashboards"
          subtitle="Trending in your organization"
          icon="chart-line"
          actions={
            <Stack direction="row" gap={2} alignItems="center">
              <ButtonGroup>
                <div className={viewMode === 'thumbnail' ? styles.activeToggle : ''}>
                  <ToolbarButton
                    icon="apps"
                    variant="default"
                    onClick={() => setViewMode('thumbnail')}
                    tooltip="Thumbnail view"
                  />
                </div>
                <div className={viewMode === 'list' ? styles.activeToggle : ''}>
                  <ToolbarButton
                    icon="list-ul"
                    variant="default"
                    onClick={() => setViewMode('list')}
                    tooltip="List view"
                  />
                </div>
              </ButtonGroup>
                <TextLink color="secondary" href="/dashboards/hackathon14/view-all-dashboards" className={styles.viewAllLink}>
                  View All
                </TextLink>
            </Stack>
              }
        />

      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <Text>Loading...</Text>
          </div>
        )}

        {data && data.resources?.length > 0 && (
          <>
            {viewMode === 'thumbnail' ? (
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
            ) : (
              <div className={styles.tableView}>
                <div className={styles.tableHeader}>
                  <div className={styles.columnToggle}></div>
                  <div className={styles.columnName}>Name</div>
                  <div className={styles.columnDetails}>Details</div>
                  <div className={styles.columnLocation}>Location</div>
                </div>
                {enrichedDashboards.map((resource) => {
                  const isExpanded = expandedRows.has(resource.uid);
                  return (
                    <div key={resource.uid}>
                      <div
                        className={styles.tableRow}
                        onClick={(e) => toggleRowExpansion(resource.uid, e)}
                      >
                        <div className={styles.columnToggle}>
                          <Icon 
                            name={isExpanded ? 'angle-down' : 'angle-right'} 
                            size="sm" 
                            className={styles.expandIcon}
                          />
                        </div>
                        <div className={styles.columnName}>
                          <Icon name="apps" size="lg" className={styles.icon} />
                          <Text weight="medium">{resource.title}</Text>
                        </div>
                        <div className={styles.columnDetails}>
                          {resource.tags && resource.tags.length > 0 ? (
                            <Text variant="bodySmall" color="secondary">
                              Tags: {resource.tags.slice(0, 3).join(', ')}
                            </Text>
                          ) : (
                            <Text variant="bodySmall" color="secondary">
                              Dashboard
                            </Text>
                          )}
                        </div>
                        <div className={styles.columnLocation}>
                          {resource.folderName ? (
                            <Stack direction="row" gap={1} alignItems="center">
                              <Icon name="folder-open" size="sm" />
                              <Text variant="bodySmall" color="secondary">
                                {resource.folderName}
                              </Text>
                            </Stack>
                          ) : (
                            <Text variant="bodySmall" color="secondary">
                              General
                            </Text>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={styles.expandedRow}>
                          <Stack direction="column" gap={2}>
                            <Stack direction="row" gap={4}>
                              <div>
                                <Text variant="bodySmall" weight="medium" color="secondary">UID:</Text>
                                <Text variant="bodySmall"> {resource.uid}</Text>
                              </div>
                              {resource.url && (
                                <div>
                                  <Text variant="bodySmall" weight="medium" color="secondary">URL:</Text>
                                  <Text variant="bodySmall"> {resource.url}</Text>
                                </div>
                              )}
                              <div>
                                <Text variant="bodySmall" weight="medium" color="secondary">Views:</Text>
                                <Text variant="bodySmall"> {resource.visitCount}</Text>
                              </div>
                            </Stack>
                            {resource.tags && resource.tags.length > 0 && (
                              <div>
                                <Text variant="bodySmall" weight="medium" color="secondary">All Tags:</Text>
                                <div className={styles.tagContainer}>
                                  {resource.tags.map((tag: string, idx: number) => (
                                    <span key={idx} className={styles.tag}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className={styles.expandedActions}>
                              <LinkButton
                                size="sm"
                                variant="primary"
                                href={resource.url}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open Dashboard
                              </LinkButton>
                            </div>
                          </Stack>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
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

const getThumbnailStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    height: '160px', // Increased height for better preview
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 'unset', // Remove border radius since it's flush with card
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
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: 1,
      pointerEvents: 'none',
    },

    '&:hover': {
      transform: 'translateY(-6px)',
      boxShadow: '0 12px 24px rgba(255, 120, 10, 0.15)',

      '&::before': {
        opacity: 0.35,
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

  tableView: css({
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),

  tableHeader: css({
    display: 'grid',
    gridTemplateColumns: '40px 2.5fr 2fr 1.5fr',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),

  tableRow: css({
    display: 'grid',
    gridTemplateColumns: '40px 2.5fr 2fr 1.5fr',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    alignItems: 'center',

    '&:hover': {
      background: theme.colors.background.secondary,
    },
  }),

  columnToggle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  }),

  columnName: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  }),

  columnDetails: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  }),

  columnLocation: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  }),

  expandIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),

  expandedRow: css({
    padding: theme.spacing(3, 3, 3, 6),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    borderLeft: `3px solid ${theme.colors.primary.main}`,
  }),

  tagContainer: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  }),

  tag: css({
    padding: theme.spacing(0.5, 1),
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),

  expandedActions: css({
    marginTop: theme.spacing(1),
  }),

  icon: css({
    color: theme.colors.primary.main,
  }),

  viewAllLink: css({
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),

  activeToggle: css({
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -2,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.shape.radius.default,
    },
  }),
});
