import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon } from '@grafana/ui';
import { AlertSearchSuggestion } from './AlertSearchSuggestion';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';

interface AlertSearchViewProps {
  query: string;
  filters: {
    firing: boolean;
    ownedByMe: boolean;
  };
}

export const AlertSearchView = ({ query, filters }: AlertSearchViewProps) => {
  const styles = useStyles2(getStyles);

  // Mock search results for now
  const mockResults = [
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

  // Filter results based on search query and filters
  const filteredResults = mockResults.filter((result) => {
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

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2}>
        <div className={styles.header}>
          <Text variant="h4">Search Results: {renderHeader()}</Text>
        </div>

        <AlertSearchSuggestion query={query} filters={filters} />

        {filteredResults.length === 0 ? (
          <Card className={styles.emptyCard}>
            <Stack direction="column" gap={2} alignItems="center">
              <Icon name="search" size="xxl" className={styles.emptyIcon} />
              <Text variant="h5">No alert rule name matches your search</Text>
              <Text color="secondary">Try adjusting your search or filters</Text>
            </Stack>
          </Card>
        ) : (
            <div>

            <BrowsingSectionTitle title={`Matched Alerts (${filteredResults.length})` }icon="alert" subtitle="" />
          <div className={styles.resultsContainer}>
            {filteredResults.map((result) => (
              <Card key={result.uid} className={styles.resultCard}>
                <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" gap={2} alignItems="center">
                    <Icon name="bell" size="lg" />
                    <div>
                      <Text weight="medium">{result.title}</Text>
                      <Text variant="bodySmall" color="secondary">
                        {result.folder}
                      </Text>
                    </div>
                  </Stack>
                  <div className={`${styles.stateBadge} ${result.state === 'firing' ? styles.firing : styles.normal}`}>
                    {result.state === 'firing' && <Icon name="fire" size="sm" />}
                    <Text variant="bodySmall">{result.state}</Text>
                  </div>
                </Stack>
              </Card>
            ))}
          </div>
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