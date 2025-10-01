import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Card,
  Stack,
  Text,
  useStyles2,
  Icon,
  Grid,
  Pagination,
  Spinner,
  LinkButton,
  ToolbarButton,
  ButtonGroup,
  FilterInput,
  useTheme2,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { SparkJoyToggle } from 'app/core/components/SparkJoyToggle';
import { setSparkJoyEnabled } from 'app/core/utils/sparkJoy';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { DashboardThumbnailCard } from './DashboardThumbnailCard';
import { HackathonTable, TableColumn, ExpandedContent } from './HackathonTable';

const DISPLAY_PAGE_SIZE = 12;

type ViewMode = 'card' | 'list';

export const ViewAllDashboards = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [currentPage, setCurrentPage] = useState(1);
  const [allDashboards, setAllDashboards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleSparkJoy = () => {
    setSparkJoyEnabled(false);
    window.location.href = '/dashboards';
  };

  const getThumbnailUrl = (dashboard: any) => {
    if (!config.rendererAvailable) {
      return null;
    }

    const params = new URLSearchParams({
      width: '1920',
      height: '1080',
      scale: '1',
      theme: theme.isDark ? 'dark' : 'light',
      kiosk: '1',
      timeout: '60',
    });

    return `${config.appSubUrl}/render/d/${dashboard.uid}?${params.toString()}`;
  };

  useEffect(() => {
    const fetchAllDashboards = async () => {
      setIsLoading(true);
      try {
        const searcher = getGrafanaSearcher();
        const result = await searcher.search({
          kind: ['dashboard'],
          query: '*',
          limit: 1000, // Fetch up to 1000 dashboards
        });

        // Get location info to map folder UIDs to folder names
        const locationInfo = await searcher.getLocationInfo();

        // Enrich dashboards with folder names
        const enrichedDashboards = (result.view || []).map((dashboard: any) => {
          const folderUid = dashboard.location;
          const folderInfo = folderUid ? locationInfo[folderUid] : null;

          return {
            ...dashboard,
            folderName: folderInfo?.name || (folderUid === 'general' ? 'General' : dashboard.location),
          };
        });

        setAllDashboards(enrichedDashboards);
      } catch (error) {
        console.error('Failed to fetch dashboards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDashboards();
  }, []);

  const handleDashboardClick = (dashboard: any) => {
    if (dashboard.url) {
      window.location.href = dashboard.url;
    }
  };

  // Table column configuration
  const columns: TableColumn[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2.5fr',
      render: (dashboard) => (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Icon name="apps" size="lg" />
          <Text weight="medium">{dashboard.name || dashboard.title}</Text>
        </Stack>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      width: '2fr',
      render: (dashboard) =>
        dashboard.tags && dashboard.tags.length > 0 ? (
          <Text variant="bodySmall" color="secondary">
            Tags: {dashboard.tags.slice(0, 3).join(', ')}
          </Text>
        ) : (
          <Text variant="bodySmall" color="secondary">
            Dashboard
          </Text>
        ),
    },
    {
      key: 'location',
      header: 'Location',
      width: '1.5fr',
      render: (dashboard) =>
        dashboard.folderName ? (
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="folder-open" size="sm" />
            <Text variant="bodySmall" color="secondary">
              {dashboard.folderName}
            </Text>
          </Stack>
        ) : (
          <Text variant="bodySmall" color="secondary">
            General
          </Text>
        ),
    },
  ];

  // Expanded content configuration
  const expandedContent: ExpandedContent = {
    render: (dashboard) => (
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={4}>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              UID:
            </Text>
            <Text variant="bodySmall"> {dashboard.uid}</Text>
          </div>
          {dashboard.url && (
            <div>
              <Text variant="bodySmall" weight="medium" color="secondary">
                URL:
              </Text>
              <Text variant="bodySmall"> {dashboard.url}</Text>
            </div>
          )}
        </Stack>
        {dashboard.tags && dashboard.tags.length > 0 && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              All Tags:
            </Text>
            <div className={styles.tagContainer}>
              {dashboard.tags.map((tag: string, idx: number) => (
                <span key={idx} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className={styles.expandedActions}>
          <LinkButton size="sm" variant="primary" href={dashboard.url} onClick={(e) => e.stopPropagation()}>
            Open Dashboard
          </LinkButton>
        </div>
      </Stack>
    ),
  };

  // Filter dashboards based on search query
  const filteredDashboards = allDashboards.filter((dashboard) => {
    if (!searchQuery) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      dashboard.name?.toLowerCase().includes(query) ||
      dashboard.title?.toLowerCase().includes(query) ||
      dashboard.folderName?.toLowerCase().includes(query) ||
      dashboard.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  });

  // Client-side pagination
  const totalItems = filteredDashboards.length;
  const totalPages = Math.ceil(totalItems / DISPLAY_PAGE_SIZE);
  const startIndex = (currentPage - 1) * DISPLAY_PAGE_SIZE;
  const endIndex = startIndex + DISPLAY_PAGE_SIZE;
  const paginatedData = filteredDashboards.slice(startIndex, endIndex);

  return (
    <Page
      navId="dashboards/browse"
      renderTitle={() => (
        <div className={styles.centeredTitle}>
          <Text variant="h2">All Dashboards</Text>
        </div>
      )}
      subTitle=""
      actions={
        // <LinkButton variant="secondary" color="grey" icon="arrow-left" href="/dashboards">
        //   {/* Back to Dashboards */}
        // </LinkButton>
        <></>
      }
    >
      <AppChromeUpdate
        actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={handleToggleSparkJoy} />]}
      />
      <Page.Contents>
        <div className={styles.container}>
          <div className={styles.searchSection}>
            <FilterInput
              placeholder="Search for dashboards"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1); // Reset to first page on search
              }}
              width={0}
            />
          </div>
          <div className={styles.header}>
            <Text variant="h5" color="secondary">
              {totalItems} {totalItems === 1 ? 'dashboard' : 'dashboards'} found
            </Text>
            <ButtonGroup>
              <div className={viewMode === 'card' ? styles.activeToggle : ''}>
                <ToolbarButton icon="apps" variant="default" onClick={() => setViewMode('card')} tooltip="Card view" />
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
          </div>

          {isLoading && (
            <div className={styles.loadingContainer}>
              <Spinner />
              <Text variant="bodySmall">Loading dashboards...</Text>
            </div>
          )}

          {!isLoading && paginatedData.length > 0 && (
            <>
              {viewMode === 'card' ? (
                <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
                  {paginatedData.map((dashboard) => (
                    <DashboardThumbnailCard
                      key={dashboard.uid}
                      uid={dashboard.uid}
                      title={dashboard.name || dashboard.title}
                      thumbnailUrl={getThumbnailUrl(dashboard)}
                      folderName={dashboard.location}
                      tags={dashboard.tags}
                      onClick={() => handleDashboardClick(dashboard)}
                      showThumbnail={true}
                    />
                  ))}
                </Grid>
              ) : (
                <HackathonTable
                  columns={columns}
                  data={paginatedData}
                  expandable={true}
                  expandedContent={expandedContent}
                  emptyMessage="No dashboards found"
                />
              )}

              {totalPages > 1 && (
                <div className={styles.paginationContainer}>
                  <Pagination numberOfPages={totalPages} currentPage={currentPage} onNavigate={setCurrentPage} />
                </div>
              )}
            </>
          )}

          {!isLoading && paginatedData.length === 0 && (
            <Card className={styles.emptyCard}>
              <Stack direction="column" gap={2} alignItems="center">
                <Icon name="search" size="xxl" className={styles.emptyIcon} />
                <Text variant="h5">No dashboards found</Text>
                <Text color="secondary">Start exploring or create your first dashboard</Text>
              </Stack>
            </Card>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  centeredTitle: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    h1: {
      marginBottom: 0,
      textAlign: 'center',
    },
  }),
  container: css({
    padding: theme.spacing(3),
  }),

  searchSection: css({
    marginBottom: theme.spacing(3),
    display: 'flex',
    justifyContent: 'center',
    width: '100%',

    '& input': {
      fontSize: theme.typography.size.md,
      padding: theme.spacing(1.5, 2),
      border: `2px solid ${theme.colors.primary.main}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
      color: theme.colors.text.primary,

      '&:focus': {
        borderColor: theme.colors.primary.main,
        boxShadow: `0 0 0 2px ${theme.colors.primary.main}25`,
      },

      '&::placeholder': {
        color: theme.colors.text.secondary,
        opacity: 0.8,
      },
    },
  }),

  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(2),
  }),

  activeToggle: css({
    position: 'relative',
    display: 'inline-block',

    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: '2px',
      left: '10%',
      right: '10%',
      height: '2px',
      background: theme.colors.primary.main,
      borderRadius: '2px',
    },
  }),

  listItemLeft: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  }),

  grid: css({
    marginTop: theme.spacing(3),
  }),

  listView: css({
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(3),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),

  tableHeader: css({
    display: 'grid',
    gridTemplateColumns: '40px 2fr 2fr 1.5fr',
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
    gridTemplateColumns: '40px 2fr 2fr 1.5fr',
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

  loadingContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6),
  }),

  dashboardCard: css({
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

  icon: css({
    color: theme.colors.primary.main,
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  paginationContainer: css({
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(4),
  }),

  emptyCard: css({
    padding: theme.spacing(6),
    textAlign: 'center',
  }),

  emptyIcon: css({
    color: theme.colors.text.secondary,
    opacity: 0.5,
  }),
});
