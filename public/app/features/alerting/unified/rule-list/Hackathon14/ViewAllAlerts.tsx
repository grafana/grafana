import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Pagination, Spinner, LinkButton, ToolbarButton, ButtonGroup, Badge, Dropdown, Menu } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { SparkJoyToggle } from 'app/core/components/SparkJoyToggle';
import { setSparkJoyEnabled } from 'app/core/utils/sparkJoy';
import { useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { HackathonTable, TableColumn, ExpandedContent } from 'app/features/browse-dashboards/hackathon14/HackathonTable';

const PAGE_SIZE = 12;

type ViewMode = 'card' | 'list';

export const ViewAllAlerts = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const { data, isLoading } = useGetPopularAlerts({
    limit: 100,
  });

  const handleToggleSparkJoy = () => {
    setSparkJoyEnabled(false);
    window.location.href = '/alerting/list';
  };

  const handleAlertClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  const getSeverityLevel = (uid: string) => {
    const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const levels = ['warning', 'critical', 'info'];
    return levels[hash % levels.length];
  };

  // Table column configuration
  const columns: TableColumn[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      render: (resource) => (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Icon name="bell" size="lg" />
          <Text weight="medium">{resource.title}</Text>
        </Stack>
      ),
    },
    {
      key: 'details',
      header: 'Message',
      width: '3fr',
      render: (resource) => (
        <div style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          <Text variant="bodySmall" color="secondary">
            {/* TODO: Backend should return annotations.summary or annotations.message field 
                which contains the alert message template like "High application latency for job {{ $labels.job }}" */}
            {resource.title}
          </Text>
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'State',
      width: '120px',
      render: (resource) => (
        <Badge 
          text={getSeverityLevel(resource.uid)} 
          color={getSeverityLevel(resource.uid) === 'critical' ? 'red' : getSeverityLevel(resource.uid) === 'warning' ? 'orange' : 'blue'} 
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      render: (resource) => (
        <Stack direction="row" gap={0.5} alignItems="center" justifyContent="flex-end">
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="View details" />
                <Menu.Item label="Silence" />
                <Menu.Item label="Duplicate" />
                <Menu.Divider />
                <Menu.Item label="Delete" />
              </Menu>
            }
          >
            <ToolbarButton variant="canvas" icon="ellipsis-v" tooltip="More options" />
          </Dropdown>
        </Stack>
      ),
    },
  ];

  // Expanded content configuration
  const expandedContent: ExpandedContent = {
    render: (resource) => (
      <Stack direction="column" gap={2}>
        {/* TODO: Once backend returns annotations, show:
            - annotations.summary: "High CPU usage on {{ $labels.instance }}"
            - annotations.description: Full explanation if available
        */}
        {resource.summary && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              Summary:
            </Text>
            <Text variant="bodySmall"> {resource.summary}</Text>
          </div>
        )}
        {resource.description && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              Description:
            </Text>
            <Text variant="bodySmall"> {resource.description}</Text>
          </div>
        )}
        <Stack direction="row" gap={4}>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              UID:
            </Text>
            <Text variant="bodySmall"> {resource.uid}</Text>
          </div>
          {resource.lastVisited && (
            <div>
              <Text variant="bodySmall" weight="medium" color="secondary">
                Last viewed:
              </Text>
              <Text variant="bodySmall"> {new Date(resource.lastVisited).toLocaleString()}</Text>
            </div>
          )}
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
    ),
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
      <AppChromeUpdate
        actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={handleToggleSparkJoy} />]}
      />
      <div className={styles.container}>
        <div className={styles.header}>
          <BrowsingSectionTitle
            title="All Alert Rules"
            subtitle=""
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
              <HackathonTable
                columns={columns}
                data={paginatedData}
                expandable={true}
                expandedContent={expandedContent}
                emptyMessage="No alert rules found"
              />
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
    gridTemplateColumns: '40px 2.5fr 2fr 1.5fr 140px',
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
    gridTemplateColumns: '40px 2.5fr 2fr 1.5fr 140px',
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

  columnActions: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  }),

  statusIcon: css({
    flexShrink: 0,
    marginRight: theme.spacing(0.5),
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
