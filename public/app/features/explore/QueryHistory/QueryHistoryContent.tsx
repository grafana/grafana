import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { EmptyState, LoadingPlaceholder, Stack, useStyles2 } from '@grafana/ui';
import { getRichHistory, SortOrder } from 'app/core/utils/richHistory';
import { RichHistoryQuery } from 'app/types/explore';

import { QueryHistoryItem } from './QueryHistoryItem';

export interface QueryHistoryContentProps {
  activeDatasources: string[];
  onSelectQuery: (query: RichHistoryQuery) => void;
}

export function QueryHistoryContent({ activeDatasources, onSelectQuery }: QueryHistoryContentProps) {
  const styles = useStyles2(getStyles);
  const [queries, setQueries] = useState<RichHistoryQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQueries = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const filters = {
          search: '',
          sortOrder: SortOrder.Descending,
          datasourceFilters: activeDatasources,
          from: 0,
          to: 30, // Last 30 days
          starred: false,
          page: 1,
        };
        
        const richHistoryResults = await getRichHistory(filters);
        setQueries(richHistoryResults.richHistory.slice(0, 50)); // Limit to 50 most recent
      } catch (err) {
        console.error('Failed to load query history:', err);
        setError('Failed to load query history');
      } finally {
        setIsLoading(false);
      }
    };

    loadQueries();
  }, [activeDatasources]);

  if (isLoading) {
    return <LoadingPlaceholder text="Loading query history..." />;
  }

  if (error) {
    return (
      <EmptyState
        variant="not-found"
        message="Failed to load query history"
      >
        <Trans i18nKey="query-history.error.description">
          There was an error loading your query history. Please try again.
        </Trans>
      </EmptyState>
    );
  }

  if (queries.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message="No query history found"
      >
        <Trans i18nKey="query-history.empty.description">
          Your query history will appear here after you run some queries.
        </Trans>
      </EmptyState>
    );
  }

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={0}>
        {queries.map((query, index) => (
          <QueryHistoryItem
            key={`${query.id}-${index}`}
            query={query}
            onSelect={() => onSelectQuery(query)}
          />
        ))}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    overflow: 'auto',
  }),
});
