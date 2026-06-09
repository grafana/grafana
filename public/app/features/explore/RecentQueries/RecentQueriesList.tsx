import { css } from '@emotion/css';
import { memo, useMemo } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceApi, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { EmptyState, ScrollContainer, Spinner, Text, useStyles2 } from '@grafana/ui';
import { createQueryText, mapQueriesToHeadings } from 'app/core/utils/richHistory';
import { type SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueryRow } from './RecentQueryRow';

type Props = {
  queries: RichHistoryQuery[];
  isLoading: boolean;
  sortOrder: SortOrder;
  onSelectQuery: (query: RichHistoryQuery) => void;
  onStarQuery: (id: string, starred: boolean) => void;
  onSaveQuery?: (query: RichHistoryQuery) => void;
};

export const RecentQueriesList = memo(function RecentQueriesList({
  queries,
  isLoading,
  sortOrder,
  onSelectQuery,
  onStarQuery,
  onSaveQuery,
}: Props) {
  const styles = useStyles2(getStyles);

  // Collect unique datasource UIDs so we resolve each once (not per-row).
  const uniqueDsUids = useMemo(() => {
    const uids = new Set<string>();
    for (const q of queries) {
      if (q.datasourceUid) {
        uids.add(q.datasourceUid);
      }
    }
    return Array.from(uids).sort();
  }, [queries]);

  // Stable key for useAsync dependency — avoids re-resolving datasources when a
  // refetch returns the same set of unique UIDs.
  const dsUidKey = uniqueDsUids.join(',');

  const { value: dsApiMap } = useAsync(async () => {
    const entries = await Promise.all(
      uniqueDsUids.map(async (uid) => {
        try {
          const dsApi = await getDataSourceSrv().get(uid);
          return [uid, dsApi] as const;
        } catch {
          return [uid, undefined] as const;
        }
      })
    );
    return new Map<string, DataSourceApi | undefined>(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsUidKey]);

  const mappedQueriesToHeadings = useMemo(() => mapQueriesToHeadings(queries, sortOrder), [queries, sortOrder]);

  if (isLoading) {
    return (
      <div className={styles.centered}>
        <Spinner />
        <Text color="secondary">{t('recent-queries.list.loading', 'Loading...')}</Text>
      </div>
    );
  }

  if (queries.length === 0) {
    return <EmptyState variant="not-found" message={t('recent-queries.list.empty', 'No recent queries found')} />;
  }

  return (
    <ScrollContainer>
      <div className={styles.listContent}>
        {Object.entries(mappedQueriesToHeadings).map(([heading, groupQueries]) => (
          <div key={heading}>
            <h4 className={styles.heading}>{heading}</h4>
            <div className={styles.group}>
              {groupQueries.map((query) => {
                const dsApi = dsApiMap?.get(query.datasourceUid);
                const logo = dsApi?.meta?.info?.logos?.small;
                const displayText = createQueryText(query.queries[0], dsApi);

                return (
                  <RecentQueryRow
                    key={query.id}
                    query={query}
                    queryDisplayText={displayText}
                    datasourceLogo={logo}
                    onSelectQuery={onSelectQuery}
                    onStarQuery={onStarQuery}
                    onSaveQuery={onSaveQuery}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollContainer>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  centered: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(4),
  }),
  listContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    paddingRight: theme.spacing(1),
    paddingTop: 0,
    [theme.breakpoints.down('lg')]: {
      paddingRight: theme.spacing(2),
    },
  }),
  heading: css({
    margin: theme.spacing(2, 0.25, 1, 0.25),
    fontSize: theme.typography.body.fontSize,
  }),
  group: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
