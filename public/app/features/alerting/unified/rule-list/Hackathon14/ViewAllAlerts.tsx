import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
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
  Badge,
  Dropdown,
  Menu,
  FilterInput,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { SparkJoyToggle } from 'app/core/components/SparkJoyToggle';
import { setSparkJoyEnabled } from 'app/core/utils/sparkJoy';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { HackathonTable, TableColumn } from 'app/features/browse-dashboards/hackathon14/HackathonTable';

const PAGE_SIZE = 12;

type ViewMode = 'card' | 'list';

type AlertRow = {
  uid: string | null;
  title: string;
  message: string;
  folderTitle: string;
  groupName: string;
  namespace: string;
  state: string;
  severity: string;
  lastEvaluation?: string;
};

export const ViewAllAlerts = () => {
  const styles = useStyles2(getStyles);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: namespaces = [], isLoading } = alertRuleApi.usePrometheusRuleNamespacesQuery({
    ruleSourceName: 'grafana',
    limitAlerts: 0,
    maxGroups: 2000,
    excludeAlerts: false,
  });

  const handleToggleSparkJoy = () => {
    setSparkJoyEnabled(false);
    window.location.href = '/alerting/list';
  };

  const handleAlertClick = (alert: AlertRow) => {
    if (alert.uid) {
      window.location.href = `/alerting/grafana/${alert.uid}/view`;
      return;
    }

    if (alert.namespace && alert.groupName) {
      const params = new URLSearchParams({
        folderUid: alert.namespace,
        group: alert.groupName,
      });
      window.location.href = `/alerting/unified/new-group?${params.toString()}`;
    }
  };

  const allAlerts: AlertRow[] = useMemo(() => {
    return namespaces.flatMap((namespace) =>
      namespace.groups.flatMap((group) =>
        group.rules
          .filter((rule) => rule.type?.toLowerCase() !== 'recording')
          .map((rule) => {
            const annotations = rule.annotations ?? {};
            const labels = rule.labels ?? {};
            const title = rule.name ?? 'Untitled rule';
            const message =
              annotations.summary ?? annotations.description ?? annotations.message ?? 'No summary provided yet.';
            const severityLabel = (labels.severity ?? labels.Severity ?? rule.health ?? 'unknown').toString();

            return {
              uid: (rule.uid as string | undefined) ?? (rule.grafana_alert as any)?.uid ?? null,
              title,
              message,
              folderTitle: namespace.folderTitle ?? namespace.name ?? 'Unknown folder',
              groupName: group.name ?? 'Unknown group',
              namespace: namespace.name ?? 'Unknown namespace',
              state: rule.state ?? 'unknown',
              severity: severityLabel,
              lastEvaluation: rule.lastEvaluation ?? rule.lastStateChange,
            } satisfies AlertRow;
          })
      )
    );
  }, [namespaces]);

  const getStateBadge = (state: string) => {
    const normalized = state.toLowerCase();
    switch (normalized) {
      case 'firing':
        return { color: 'red' as const, text: 'Firing' };
      case 'pending':
        return { color: 'orange' as const, text: 'Pending' };
      case 'inactive':
        return { color: 'blue' as const, text: 'Inactive' };
      case 'normal':
        return { color: 'blue' as const, text: 'Normal' };
      default:
        return { color: 'green' as const, text: normalized || 'Unknown' };
    }
  };

  // Table column configuration
  const columns: TableColumn<AlertRow>[] = [
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
      width: '2.5fr',
      render: (resource) => (
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <Text variant="bodySmall" color="secondary">
            {resource.message}
          </Text>
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      width: '1.5fr',
      render: (resource) => (
        <Text variant="bodySmall" color="secondary">
          {resource.groupName}
        </Text>
      ),
    },
    {
      key: 'activity',
      header: 'State',
      width: '120px',
      render: (resource) => {
        const badge = getStateBadge(resource.state);
        return <Badge text={badge.text} color={badge.color} />;
      },
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
  // Filter alerts based on search query
  const filteredAlerts = allAlerts.filter((alert) => {
    if (!searchQuery) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      alert.title.toLowerCase().includes(query) ||
      alert.folderTitle.toLowerCase().includes(query) ||
      alert.groupName.toLowerCase().includes(query) ||
      alert.message.toLowerCase().includes(query)
    );
  });

  // Client-side pagination
  const totalItems = filteredAlerts.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedData = filteredAlerts.slice(startIndex, endIndex);

  return (
    <AlertingPageWrapper
      navId="alert-list"
      isLoading={false}
      renderTitle={() => (
        <div className={styles.centeredTitle}>
          <Text variant="h2">All Alerts</Text>
        </div>
      )}
      subTitle=""
      actions={
        <LinkButton variant="secondary" color="grey" icon="arrow-left" href="/alerting/list">
          Back to browsing
        </LinkButton>
      }
    >
      <AppChromeUpdate
        actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={handleToggleSparkJoy} />]}
      />
      <div className={styles.container}>
        <div className={styles.searchSection}>
          <FilterInput
            placeholder="Search for alert rules"
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
            {totalItems} {totalItems === 1 ? 'alert rule' : 'alert rules'} found
          </Text>
          <ButtonGroup>
            <div className={viewMode === 'card' ? styles.activeToggle : ''}>
              <ToolbarButton icon="apps" variant="default" onClick={() => setViewMode('card')} tooltip="Card view" />
            </div>
            <div className={viewMode === 'list' ? styles.activeToggle : ''}>
              <ToolbarButton icon="list-ul" variant="default" onClick={() => setViewMode('list')} tooltip="List view" />
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
                    subtitle={`${resource.folderTitle || 'Default'}`}
                    onClick={() => handleAlertClick(resource.uid)}
                  />
                ))}
              </Grid>
            ) : (
          <HackathonTable
            columns={columns}
            data={paginatedData}
            expandable={false}
            emptyMessage="No alert rules found"
            onRowClick={(resource) => handleAlertClick(resource)}
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
