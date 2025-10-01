import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Stack, Text, useStyles2, Icon, Grid, useTheme2, ButtonGroup, Box, TextLink, ToolbarButton, Badge } from '@grafana/ui';
import { useGetPopularDashboards } from 'app/features/dashboard/api/popularResourcesApi';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';
import { DashboardThumbnailCard } from './DashboardThumbnailCard';
import { HackathonTable, TableColumn } from './HackathonTable';

export const MostPopularDashboards = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [viewMode, setViewMode] = useState<'thumbnail' | 'list'>('thumbnail');
  const [enrichedDashboards, setEnrichedDashboards] = useState<any[]>([]);
  const { data, isLoading } = useGetPopularDashboards({
    limit: 8,
    period: '30d',
  });

  const handleResourceClick = (resource: any) => {
    // Navigate to the resource URL
    window.location.href = resource.url;
  };

  useEffect(() => {
    const enrichDashboards = async () => {
      if (!data?.resources) {
        setEnrichedDashboards([]);
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
        const enrichedData = data.resources.map((resource, index) => {
          const dashboardDetail = dashboardMap.get(resource.uid);
          const folderUid = dashboardDetail?.location;
          const folderInfo = folderUid ? locationInfo[folderUid] : null;

          return {
            ...resource,
            tags: dashboardDetail?.tags || [],
            folderName: folderInfo?.name || (folderUid === 'general' ? 'General' : folderUid || 'Unknown'),
            description: dashboardDetail?.description,
            lastInteraction: resource.lastVisited || dashboardDetail?.updated || resource.lastUpdated,
            isTrending: index === 0,
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

  const formatRelativeTime = (date?: string) => {
    if (!date) {
      return 'Recently updated';
    }

    const diffMs = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
    const weeks = Math.floor(days / 7);
    if (weeks < 5) {
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }
    const months = Math.floor(days / 30);
    if (months < 12) {
      return `${months} month${months === 1 ? '' : 's'} ago`;
    }
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
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
              <Grid gap={3} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} className={styles.gridLayout}>
                {enrichedDashboards.map((resource) => {
                  const thumbnailUrl = getThumbnailUrl(resource);

                  return (
                    <DashboardThumbnailCard
                      key={resource.uid}
                      uid={resource.uid}
                      title={resource.title}
                      thumbnailUrl={thumbnailUrl}
                      folderName={resource.folderName}
                      tags={resource.tags}
                      lastVisited={resource.lastVisited}
                      visitCount={resource.visitCount}
                      onClick={() => handleResourceClick(resource)}
                      showThumbnail={true}
                    />
                  );
                })}
              </Grid>
            ) : (
              <HackathonTable
                columns={getTableColumns(theme, formatRelativeTime)}
                data={enrichedDashboards}
                emptyMessage="No popular dashboards found"
                onRowClick={(item) => handleResourceClick(item)}
              />
            )}
          </>
        )}

        {/* TODO: show default dashboards list */}
        {data && data.resources?.length === 0 && (
          <Box className={styles.emptyCard}>
            <Text color="secondary">No data.</Text>
          </Box>
        )}
      </div>
    </Box>
  );
};

const getThumbnailStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    height: '160px',
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  image: css({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }),
});

const getTableColumns = (theme: GrafanaTheme2, formatRelativeTime: (date?: string) => string): TableColumn[] => [
  {
    key: 'name',
    header: 'Name and Location',
    width: '3fr',
    render: (item) => (
      <Stack direction="column" gap={0.5} minWidth={0}>
        <Stack direction="row" gap={1} alignItems="center" minWidth={0}>
          <Icon name="apps" size="md" color={theme.colors.text.secondary} />
          <Text weight="medium" ellipsize>
            {item.title}
          </Text>
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center" minWidth={0}>
          <Icon name="align-left" size="sm" color={theme.colors.text.secondary} />
          <Text variant="bodySmall" color="secondary" ellipsize>
            {item.description || 'Configuration success rate improvements'}
          </Text>
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center" minWidth={0}>
          <Icon name="folder-open" size="sm" color={theme.colors.text.secondary} />
          <Text variant="bodySmall" color="secondary" ellipsize>
            {item.folderName ?? 'General'}
          </Text>
        </Stack>
      </Stack>
    ),
  },
  {
    key: 'tags',
    header: 'Tags',
    width: '2fr',
    render: (item) => (
      <Stack direction="row" gap={0.5} wrap="wrap">
        {item.tags?.slice(0, 3).map((tag: string, index: number) => (
          <Badge key={tag} text={tag} color={tagColors[index % tagColors.length]} />
        ))}
        {item.tags?.length > 3 && <Badge text={`+${item.tags.length - 3}`} color="darkgrey" />}
      </Stack>
    ),
  },
  {
    key: 'views',
    header: 'Views past month',
    width: '1fr',
    render: (item) => (
      <Stack direction="row" gap={0.5} alignItems="center" justifyContent="flex-start">
        <Text variant="bodySmall">{item.visitCount ?? '—'}</Text>
        {item.isTrending && <Icon name="fire" size="sm" color="#F97316" />}
      </Stack>
    ),
  },
  {
    key: 'lastEdited',
    header: 'Last edited',
    width: '1fr',
    render: (item) => (
      <Text variant="bodySmall" color="secondary">
        {formatRelativeTime(item.lastInteraction)}
      </Text>
    ),
  },
];

const tagColors: Array<'orange' | 'purple' | 'blue' | 'green'> = ['orange', 'purple', 'blue', 'green'];

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

  gridLayout: css({
    alignItems: 'stretch',
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
