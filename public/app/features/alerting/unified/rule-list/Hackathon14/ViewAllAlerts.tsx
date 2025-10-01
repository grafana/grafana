import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Pagination, Spinner, LinkButton, ToolbarButton, ButtonGroup } from '@grafana/ui';
import { useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';

const PAGE_SIZE = 12;

type ViewMode = 'card' | 'list';

export const ViewAllAlerts = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const { data, isLoading } = useGetPopularAlerts({
    limit: 100,
  });

  const handleAlertClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
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
  const totalItems = data?.resources?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedData = data?.resources?.slice(startIndex, endIndex) || [];

  return (
    <AlertingPageWrapper
      navId="alert-list"
      isLoading={false}
      actions={
        <LinkButton variant="secondary" color="grey" icon="arrow-left" href="/alerting/list">
          Back to Alert Rules
        </LinkButton>
      }
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <BrowsingSectionTitle
            title="All Popular Alert Rules"
            subtitle={`${totalItems} alert rules based on visit activity`}
            icon="bell"
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
            <Text variant="bodySmall">Loading alert rules...</Text>
          </div>
        )}

        {!isLoading && paginatedData.length > 0 && (
          <>
            {viewMode === 'card' ? (
              <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3 }}>
                {paginatedData.map((resource) => (
                  <RecentVisitCard
                    key={resource.uid}
                    type="alert"
                    title={resource.title}
                    subtitle={`${resource.visitCount} views`}
                    onClick={() => handleAlertClick(resource.uid)}
                  />
                ))}
              </Grid>
            ) : (
              <div className={styles.listView}>
                <div className={styles.tableHeader}>
                  <div className={styles.columnToggle}></div>
                  <div className={styles.columnName}>Name</div>
                  <div className={styles.columnDetails}>Details</div>
                  <div className={styles.columnViews}>Activity</div>
                </div>
                {paginatedData.map((resource) => {
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
                          <Icon name="bell" size="lg" className={styles.icon} />
                          <Text weight="medium">{resource.title}</Text>
                        </div>
                        <div className={styles.columnDetails}>
                          <Text variant="bodySmall" color="secondary">
                            Alert Rule
                          </Text>
                        </div>
                        <div className={styles.columnViews}>
                          <Stack direction="row" gap={1} alignItems="center">
                            <Icon name="eye" size="sm" />
                            <Text variant="bodySmall" color="secondary">
                              {resource.visitCount} views
                            </Text>
                          </Stack>
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
                              <div>
                                <Text variant="bodySmall" weight="medium" color="secondary">Views:</Text>
                                <Text variant="bodySmall"> {resource.visitCount}</Text>
                              </div>
                            </Stack>
                            <div className={styles.expandedActions}>
                              <LinkButton
                                size="sm"
                                variant="primary"
                                href={`/alerting/grafana/${resource.uid}/view`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Alert Rule
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
              <Icon name="bell" size="xxl" className={styles.emptyIcon} />
              <Text variant="h5">No alert rules found</Text>
              <Text color="secondary">Create your first alert rule to get started</Text>
            </Stack>
          </Card>
        )}
      </div>
    </AlertingPageWrapper>
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

  columnViews: css({
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

  expandedActions: css({
    marginTop: theme.spacing(1),
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

  loadingContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6),
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
