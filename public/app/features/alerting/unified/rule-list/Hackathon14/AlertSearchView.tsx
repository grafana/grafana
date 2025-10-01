import { css } from '@emotion/css';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Badge, LinkButton } from '@grafana/ui';
import { AlertSearchSuggestion } from './AlertSearchSuggestion';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { HackathonTable, TableColumn, ExpandedContent } from 'app/features/browse-dashboards/hackathon14/HackathonTable';
import { useGetPopularAlerts, useGetRecentAlerts } from 'app/features/dashboard/api/popularResourcesApi';

interface AlertSearchViewProps {
  query: string;
  filters: {
    firing: boolean;
    ownedByMe: boolean;
  };
}

export const AlertSearchView = ({ query, filters }: AlertSearchViewProps) => {
  const styles = useStyles2(getStyles);

  // Fetch real alert data from API
  const { data: popularAlerts, isLoading: popularLoading } = useGetPopularAlerts({ limit: 50, period: '30d' });
  const { data: recentAlerts, isLoading: recentLoading } = useGetRecentAlerts({ limit: 50, period: '30d' });

  const isLoading = popularLoading || recentLoading;

  // Combine popular and recent alerts, removing duplicates
  const allAlerts = [
    ...(popularAlerts?.resources || []),
    ...(recentAlerts?.resources || []).filter(
      (recent) => !popularAlerts?.resources?.some((popular) => popular.uid === recent.uid)
    ),
  ];

  // For mock structure compatibility (TODO: remove when backend provides all fields)
  const mockResults = allAlerts.map((alert) => ({
    uid: alert.uid,
    title: alert.title,
    state: 'normal', // TODO: Get from backend
    folder: 'N/A', // TODO: Get from backend  
    createdBy: 'unknown', // TODO: Get from backend
  }));

  // Keep original mock for fallback
  const fallbackMockResults = [
    {
      uid: '1',
      title: 'High CPU Usage Alert',
      state: 'firing',
      folder: 'Production',
      createdBy: 'me',
    },
    {
      uid: '2',
      title: 'Disk Space Warning',
      state: 'normal',
      folder: 'Infrastructure',
      createdBy: 'admin',
    },
    {
      uid: '3',
      title: 'API Response Time',
      state: 'firing',
      folder: 'APIs',
      createdBy: 'me',
    },
    {
      uid: '4',
      title: 'Memory Usage Critical',
      state: 'firing',
      folder: 'Production',
      createdBy: 'me',
    },
    {
      uid: '5',
      title: 'Database Connection Pool',
      state: 'normal',
      folder: 'Database',
      createdBy: 'me',
    },
    {
      uid: '6',
      title: 'Network Latency Alert',
      state: 'normal',
      folder: 'Infrastructure',
      createdBy: 'admin',
    },
    {
      uid: '7',
      title: 'Error Rate Threshold',
      state: 'firing',
      folder: 'APIs',
      createdBy: 'me',
    },
    {
      uid: '8',
      title: 'SSL Certificate Expiring',
      state: 'normal',
      folder: 'Security',
      createdBy: 'admin',
    },
    {
      uid: '9',
      title: 'Load Balancer Health',
      state: 'normal',
      folder: 'Infrastructure',
      createdBy: 'me',
    },
    {
      uid: '10',
      title: 'Cache Hit Rate Low',
      state: 'normal',
      folder: 'Performance',
      createdBy: 'me',
    },
  ];

  // Use real data if available, otherwise use fallback mock
  const resultsToUse = allAlerts.length > 0 ? mockResults : fallbackMockResults;

  // Filter results based on search query and filters
  const filteredResults = resultsToUse.filter((result) => {
    // Filter by search query
    if (query && !result.title.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }

    // Filter by firing state
    if (filters.firing && result.state !== 'firing') {
      return false;
    }

    // Filter by owned by me
    if (filters.ownedByMe && result.createdBy !== 'me') {
      return false;
    }

    return true;
  });

  const renderHeader = () => {
    const parts = [];
    if (query) {
      parts.push(`"${query}"`);
    }
    if (filters.firing) {
      parts.push('Firing');
    }
    if (filters.ownedByMe) {
      parts.push('Created by me');
    }

    return parts.length > 0 ? parts.join(' • ') : 'All Alert Rules';
  };

  // Get state badge configuration
  const getStateBadgeConfig = (state: string) => {
    const stateUpper = state.toUpperCase();
    switch (stateUpper) {
      case 'FIRING':
        return { text: 'Firing', color: 'red' as const, icon: 'fire' as IconName };
      case 'PENDING':
        return { text: 'Pending', color: 'orange' as const, icon: 'exclamation-triangle' as IconName };
      default:
        return { text: 'Normal', color: 'green' as const, icon: 'check-circle' as IconName };
    }
  };

  // Table column configuration
  const columns: TableColumn[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2.5fr',
      render: (item) => (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Icon name="bell" size="lg" />
          <Text weight="medium">{item.title}</Text>
        </Stack>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      width: '3fr',
      render: (item) => (
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Text variant="bodySmall" color="secondary">
            {item.title}
          </Text>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: '120px',
      render: (item) => {
        const badgeConfig = getStateBadgeConfig(item.state);
        return (
          <Badge text={badgeConfig.text} color={badgeConfig.color} icon={badgeConfig.icon} />
        );
      },
    },
  ];

  // Expanded content configuration
  const expandedContent: ExpandedContent = {
    render: (item) => (
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={4}>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              UID:
            </Text>
            <Text variant="bodySmall"> {item.uid}</Text>
          </div>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              Folder:
            </Text>
            <Text variant="bodySmall"> {item.folder || 'N/A'}</Text>
          </div>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              Created by:
            </Text>
            <Text variant="bodySmall"> {item.createdBy || 'N/A'}</Text>
          </div>
        </Stack>
        <div>
          <LinkButton
            size="sm"
            variant="primary"
            href={`/alerting/grafana/${item.uid}/view`}
            onClick={(e) => e.stopPropagation()}
          >
            View Alert Rule
          </LinkButton>
        </div>
      </Stack>
    ),
  };

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2}>
        <div className={styles.header}>
          <Text variant="h4">Search Results: {renderHeader()}</Text>
        </div>

        <AlertSearchSuggestion query={query} filters={filters} />

        {isLoading ? (
          <Card className={styles.emptyCard}>
            <Stack direction="column" gap={2} alignItems="center">
              <Icon name="fa fa-spinner" size="xxl" className={styles.emptyIcon} />
              <Text variant="h5">Loading alert rules...</Text>
            </Stack>
          </Card>
        ) : filteredResults.length === 0 ? (
          <Card className={styles.emptyCard}>
            <Stack direction="column" gap={2} alignItems="center">
              <Icon name="search" size="xxl" className={styles.emptyIcon} />
              <Text variant="h5">No alert rule name matches your search</Text>
              <Text color="secondary">Try adjusting your search or filters</Text>
            </Stack>
          </Card>
        ) : (
          <div>
            <BrowsingSectionTitle title={`Matched Alerts (${filteredResults.length})`} icon="bell" subtitle="" />
            <HackathonTable
              columns={columns}
              data={filteredResults}
              expandable={true}
              expandedContent={expandedContent}
              onRowClick={(item) => (window.location.href = `/alerting/grafana/${item.uid}/view`)}
              emptyMessage="No alert rules found"
            />
          </div>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2, 0),
  }),

  header: css({
    marginBottom: theme.spacing(2),
  }),

  resultsContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  }),

  resultCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    
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
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 16px rgba(255, 120, 10, 0.18)',
      
      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  stateBadge: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.radius.pill,
    textTransform: 'capitalize',
  }),

  firing: css({
    backgroundColor: theme.colors.error.main + '20',
    color: theme.colors.error.text,
  }),

  normal: css({
    backgroundColor: theme.colors.success.main + '20',
    color: theme.colors.success.text,
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