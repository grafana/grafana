import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Pagination, Spinner, LinkButton, ToolbarButton, ButtonGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';

const DISPLAY_PAGE_SIZE = 12;

type ViewMode = 'card' | 'list';

export const ViewAllDashboards = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [allDashboards, setAllDashboards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  // Client-side pagination
  const totalItems = allDashboards.length;
  const totalPages = Math.ceil(totalItems / DISPLAY_PAGE_SIZE);
  const startIndex = (currentPage - 1) * DISPLAY_PAGE_SIZE;
  const endIndex = startIndex + DISPLAY_PAGE_SIZE;
  const paginatedData = allDashboards.slice(startIndex, endIndex);

  return (
    <Page navId="dashboards/browse" actions={
      <LinkButton variant="secondary" color="grey" icon="arrow-left" href="/dashboards">
        Back to Dashboards
      </LinkButton>
    }>
      <Page.Contents>
        <div className={styles.container}>
          <div className={styles.header}>
            <BrowsingSectionTitle
              title="All Dashboards"
              subtitle={`${totalItems} dashboards in your organization`}
              icon="apps"
            />
            <ButtonGroup>
              <div className={viewMode === 'card' ? styles.activeToggle : ''}>
                <ToolbarButton
                  icon="apps"
                  variant="default"
                  onClick={() => setViewMode('card')}
                  tooltip="Card view"
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
                    <Card
                      key={dashboard.uid}
                      className={styles.dashboardCard}
                      onClick={() => handleDashboardClick(dashboard)}
                    >
                      <Stack direction="column" gap={2}>
                        <Stack direction="row" gap={2} alignItems="center">
                          <Icon name="apps" size="lg" className={styles.icon} />
                          <div className={styles.titleWrapper}>
                            <Text weight="medium">{dashboard.name || dashboard.title}</Text>
                          </div>
                        </Stack>
                        <Stack direction="row" gap={2} justifyContent="space-between">
                          {dashboard.location && (
                            <Stack direction="row" gap={1} alignItems="center">
                              <Icon name="folder-open" size="sm" />
                              <Text variant="bodySmall" color="secondary">
                                {dashboard.location}
                              </Text>
                            </Stack>
                          )}
                          {dashboard.tags && dashboard.tags.length > 0 && (
                            <Text variant="bodySmall" color="secondary">
                              {dashboard.tags[0]}
                            </Text>
                          )}
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Grid>
              ) : (
                <div className={styles.listView}>
                  <div className={styles.tableHeader}>
                    <div className={styles.columnToggle}></div>
                    <div className={styles.columnName}>Name</div>
                    <div className={styles.columnDetails}>Details</div>
                    <div className={styles.columnLocation}>Location</div>
                  </div>
                  {paginatedData.map((dashboard) => {
                    const isExpanded = expandedRows.has(dashboard.uid);
                    return (
                      <div key={dashboard.uid}>
                        <div
                          className={styles.tableRow}
                          onClick={(e) => toggleRowExpansion(dashboard.uid, e)}
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
                            <Text weight="medium">{dashboard.name || dashboard.title}</Text>
                          </div>
                          <div className={styles.columnDetails}>
                            {dashboard.tags && dashboard.tags.length > 0 ? (
                              <Text variant="bodySmall" color="secondary">
                                Tags: {dashboard.tags.slice(0, 3).join(', ')}
                              </Text>
                            ) : (
                              <Text variant="bodySmall" color="secondary">
                                Dashboard
                              </Text>
                            )}
                          </div>
                          <div className={styles.columnLocation}>
                            {dashboard.folderName ? (
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
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className={styles.expandedRow}>
                            <Stack direction="column" gap={2}>
                              <Stack direction="row" gap={4}>
                                <div>
                                  <Text variant="bodySmall" weight="medium" color="secondary">UID:</Text>
                                  <Text variant="bodySmall"> {dashboard.uid}</Text>
                                </div>
                                {dashboard.url && (
                                  <div>
                                    <Text variant="bodySmall" weight="medium" color="secondary">URL:</Text>
                                    <Text variant="bodySmall"> {dashboard.url}</Text>
                                  </div>
                                )}
                              </Stack>
                              {dashboard.tags && dashboard.tags.length > 0 && (
                                <div>
                                  <Text variant="bodySmall" weight="medium" color="secondary">All Tags:</Text>
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
                                <LinkButton
                                  size="sm"
                                  variant="primary"
                                  href={dashboard.url}
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

              {totalPages > 1 && (
                <div className={styles.paginationContainer}>
                  <Pagination
                    numberOfPages={totalPages}
                    currentPage={currentPage}
                    onNavigate={setCurrentPage}
                  />
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
  container: css({
    padding: theme.spacing(3),
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
