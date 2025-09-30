/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useEffect, useState, useRef } from 'react';

import {
  TimeRange,
  PanelData,
  LoadingState,
  DataQueryRequest,
  dateTime,
  DataSourceApi,
  DataQuery,
} from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { Stack, Text, useTheme2, Spinner, Avatar, Button, Badge } from '@grafana/ui';
import { RichHistoryQuery } from 'app/types/explore';

import { useQueriesDrawerContext } from '../../explore/QueriesDrawer/QueriesDrawerContext';
import { useQueryHistoryContext } from '../../explore/QueryHistory/QueryHistoryContext';
import { useQueryLibraryContext } from '../../explore/QueryLibrary/QueryLibraryContext';

import { useQueryPatterns } from './QueryPatternStarter';


// Unified interface for query items used in the SparkJoy section
interface QueryItem {
  title: string;
  query: DataQuery;
  uid: string;
  timestamp?: number;
  createdBy?: string;
  createdAt?: number;
  userInfo?: {
    displayName: string;
    avatarURL: string;
  };
  // Pattern-specific fields
  isPattern?: boolean;
  patternType?: 'grafana' | 'user';
}

// Interface for the saved queries API response
interface SavedQueryAPIResponse {
  items: Array<{
    metadata: {
      uid: string;
      name?: string;
      annotations?: {
        'grafana.app/createdBy'?: string;
      };
      creationTimestamp?: string;
    };
    spec: {
      title: string;
      description?: string;
      targets: DataQuery[];
    };
  }>;
}

// Interface for user display information
interface UserDisplayInfo {
  displayName: string;
  avatarURL: string;
  identity: {
    type: string;
    name: string;
  };
}

// Function to fetch user display information
const fetchUserDisplayInfo = async (userKey: string): Promise<UserDisplayInfo | null> => {
  try {
    const response = await getBackendSrv().get(
      `apis/iam.grafana.app/v0alpha1/namespaces/stacks-42/display`,
      { key: userKey }
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch user display info:', error);
    return null;
  }
};

// Custom hook to fetch saved queries (similar to useListQueryQuery pattern)
const useSavedQueries = (datasourceName?: string, limit = 4) => {
  const [data, setData] = useState<QueryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchQueries = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Fetching saved queries with datasourceName:', datasourceName, 'limit:', limit);
        const response: SavedQueryAPIResponse = await getBackendSrv().get(
          'apis/queries.grafana.app/v1beta1/namespaces/stacks-42/queries',
          { limit: limit * 2 } // Fetch more to account for filtering
        );
        console.log('Saved queries API response:', response);

        const filteredItems = response.items
          .filter((item) => {
            console.log('item', item);
            // Filter by datasource if provided
            if (datasourceName && item.spec.targets?.[0]?.datasource) {
              const queryDatasource = item.spec.targets[0].datasource;
              const dsName = typeof queryDatasource === 'string' ? queryDatasource : queryDatasource?.type;
              return dsName === datasourceName;
            }
            return true;
          })
          .filter((item) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
            return (item.spec.targets?.[0] as any)?.properties !== undefined;
          })
          .slice(0, limit);

        // Process queries first without user info to avoid blocking
        const basicQueries = filteredItems.map((item) => ({
          title: item.spec.title || 'Untitled query',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          query: (item.spec.targets?.[0] as any)?.properties!,
          uid: item.metadata.uid,
          createdBy: item.metadata.annotations?.['grafana.app/createdBy'],
          createdAt: item.metadata.creationTimestamp ? new Date(item.metadata.creationTimestamp).getTime() : undefined,
          userInfo: undefined,
        }));

        // Set basic queries first so UI shows something immediately
        setData(basicQueries);

        // Then try to fetch user information for each query
        try {
          const processedQueries = await Promise.all(
            filteredItems.map(async (item) => {
              const createdBy = item.metadata.annotations?.['grafana.app/createdBy'];
              let userInfo = undefined;

              if (createdBy) {
                try {
                  console.log('Fetching user info for:', createdBy);
                  const userDisplayInfo = await fetchUserDisplayInfo(createdBy);
                  console.log('User display info response:', userDisplayInfo);
                  if (userDisplayInfo) {
                    // Convert relative avatar URL to full URL
                    const response =  await getBackendSrv().get(
          `apis/iam.grafana.app/v0alpha1/namespaces/stacks-42/display?key=${createdBy}`,
                    );

                    userInfo = {
                      displayName:response.display[0].displayName,
                      avatarURL:response.display[0].avatarURL,
                    };
                  }
                } catch (userError) {
                  console.warn('Failed to fetch user info for', createdBy, ':', userError);
                  // Continue without user info rather than failing the whole query
                }
              }

              return {
                title: item.spec.title || 'Untitled query',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
                query: (item.spec.targets?.[0] as any)?.properties!,
                uid: item.metadata.uid,
                createdBy,
                createdAt: item.metadata.creationTimestamp ? new Date(item.metadata.creationTimestamp).getTime() : undefined,
                userInfo,
              };
            })
          );

          // Update with full user info
          console.log('Setting processed queries with user info:', processedQueries);
          setData(processedQueries);
        } catch (userFetchError) {
          console.warn('Failed to fetch user info, using basic queries:', userFetchError);
          // Keep the basic queries without user info
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch saved queries');
        console.error('Failed to fetch saved queries:', error);
        console.error('Error details:', err);
        setError(error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueries();
  }, [datasourceName, limit]);

  return { data, isLoading, error };
};


// Helper function to format timestamp
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
};

interface QueryCardProps {
  query: QueryItem;
  onClick: () => void;
  datasource: DataSourceApi<DataQuery>;
  timeRange?: TimeRange;
  isRecentQuery?: boolean;
  timestamp?: number;
}

const QueryCard = ({ query, onClick, datasource, timeRange, isRecentQuery, timestamp }: QueryCardProps) => {
  const theme = useTheme2();
  const [previewData, setPreviewData] = useState<PanelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Debug logging
  console.log('QueryCard props:', { query, isRecentQuery, timestamp, userInfo: query.userInfo, createdAt: query.createdAt });

  useEffect(() => {
    const fetchPreviewData = async () => {
      if (!query || typeof query !== 'object' || query === null || !query.query) {
        return;
      }

      // Use a default time range if none provided (last 1 hour)
      const effectiveTimeRange = timeRange || {
        from: dateTime(Date.now() - 60 * 60 * 1000),
        to: dateTime(),
        raw: { from: 'now-1h', to: 'now' },
      };

      setIsLoading(true);
      try {
        const uniqueId = Math.random().toString(36).substring(2, 15);

        // Create a generic query object - each datasource will need to adapt this
        const target = {
          ...query.query,
          refId: `sparkjoy-${uniqueId}`,
          datasource: datasource.getRef(),
        };

        const request: DataQueryRequest = {
          targets: [target],
          range: effectiveTimeRange,
          scopedVars: {},
          timezone: 'browser',
          app: 'explore',
          requestId: `sparkjoy-preview-${uniqueId}`,
          interval: '1s',
          intervalMs: 1000,
          maxDataPoints: 100,
          startTime: Date.now(),
        };

        const observable = datasource.query(request);
        const result =
          'toPromise' in observable
            ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
              await (observable as { toPromise(): Promise<any> }).toPromise()
            : await Promise.resolve(observable);

        if (result && result.data && result.data.length > 0) {
          setPreviewData({
            series: result.data,
            state: LoadingState.Done,
            timeRange: effectiveTimeRange,
          });
        } else {
          // Even if no data, set a valid state so we can show "No data found"
          setPreviewData({
            series: [],
            state: LoadingState.Done,
            timeRange: effectiveTimeRange,
          });
        }
      } catch (error) {
        console.error('SparkJoy: Error fetching preview data:', error);
        const queryError = error instanceof Error ? { message: error.message } : { message: 'Failed to load preview' };
        setPreviewData({
          series: [],
          state: LoadingState.Error,
          error: queryError,
          timeRange: effectiveTimeRange,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource]);

  const getPreviewText = () => {
    if (isLoading) {
      return 'Loading preview...';
    }
    if (!previewData) {
      return 'No preview available';
    }
    if (previewData.state === LoadingState.Error) {
      return 'Error loading preview';
    }

    const series = previewData.series;
    if (!series || series.length === 0) {
      return 'No data found';
    }

    const firstSeries = series[0];
    const totalRows = firstSeries.length;
    const unit = firstSeries.meta?.preferredVisualisationType === 'logs' ? 'logs' : 'data points';

    if (totalRows === 0) {
      return 'No data found';
    }
    if (totalRows >= 1000) {
      return `1000+ ${unit}`;
    }
    if (totalRows === 1) {
      return `1 ${unit}`;
    }
    return `${totalRows.toLocaleString()} ${unit}`;
  };

  const styles = {
    card: {
      cursor: 'pointer',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1), // isCompact padding
      marginBottom: 0, // noMargin equivalent
      position: 'relative' as const,
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        cursor: 'pointer',
        zIndex: 1,
      },
      '&:focus': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '2px',
      },
    },
    content: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing(1),
    },
    mainContent: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing(1),
      flex: 1,
    },
    query: {
      fontFamily: theme.typography.fontFamilyMonospace,
      padding: theme.spacing(1),
      wordBreak: 'break-all' as const,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
    },
    queryText: {
      padding: theme.spacing(0.25, 0.5),
      fontSize: theme.typography.body.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      overflow: 'auto',
      backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.06),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    },
    previewRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      margin: theme.spacing(0, 1),
    },
    preview: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      minHeight: '20px',
      flex: 1,
    },
    previewIcon: {
      flexShrink: 0,
    },
    badge: {
      fontSize: theme.typography.bodySmall.fontSize,
      borderRadius: '1em',
    },
    userBadge: {
      fontSize: theme.typography.bodySmall.fontSize,
      padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      borderRadius: theme.shape.radius.default,
    },
    badgeAvatar: {
      marginLeft: theme.spacing(0.5),
    },
  };
  const queryDisplayText = datasource?.getQueryDisplayText?.(query.query) ?? JSON.stringify(query.query);

  console.log('query', query);
  return (
    <div
      className={css(styles.card)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className={css(styles.content)}>
        <div className={css(styles.mainContent)}>
          {/* Always use monospace style for now - can be extended per datasource */}
          <div className={css(styles.query)}><span className={css(styles.queryText)}>{queryDisplayText}</span></div>

          <div className={css(styles.previewRow)}>
            <div className={css(styles.preview)}>
              {isLoading ? (
                <>
                  <Spinner className={css(styles.previewIcon)} size={12} />
                  <span>{getPreviewText()}</span>
                </>
              ) : (
                <>
                  <span>{getPreviewText()}</span>
                  <span style={{ color: theme.colors.text.secondary, margin: theme.spacing(0, 0.25) }}>|</span>
                  {isRecentQuery && timestamp && (
                    <span style={{ color: theme.colors.text.secondary }}>
                    Last run {formatTimestamp(timestamp)}
                    </span>
                  )}
                  {!isRecentQuery && (
                    <span style={{ color: theme.colors.text.secondary }}>
                      Created {formatTimestamp(query.createdAt || 0)}
                    </span>
                  )}
                  <span style={{ color: theme.colors.text.secondary, margin: theme.spacing(0, 0.25) }}>|</span>
                  <span style={{ color: theme.colors.text.secondary }}>
                    {isRecentQuery ? 'Created by' : 'Recommended by'}
                  </span>
                  {isRecentQuery && timestamp && (
              <Badge 
                text={
                  <div className={css(styles.userBadge)}>
                    <Avatar
                      src={config.bootData.user.gravatarUrl || ''}
                      alt={`${config.bootData.user.name} avatar`}
                      width={2}
                      height={2}
                    />
                    {config.bootData.user.name}
                  </div>
                }
                color="green" 
                className={css(styles.badge)}
              />
            )}
            {query.isPattern && query.patternType === 'grafana' && (
              <Badge 
                text="Grafana" 
                color="orange" 
                className={css(styles.badge)}
              />
            )}
            {!isRecentQuery && query.userInfo && !query.isPattern && (
 <Badge 
 text={
   <div className={css(styles.userBadge)}>
     <Avatar
       src={query.userInfo.avatarURL || ''}
       alt={`${query.userInfo.displayName} avatar`}
       width={2}
       height={2}
     /> 
     {query.userInfo.displayName}
   </div>
 }
 color="blue" 
 className={css(styles.badge)}
/>
            )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


interface SparkJoySectionProps<TQuery extends DataQuery> {
  datasource: DataSourceApi<TQuery>;
  history: RichHistoryQuery[];
  onChangeQuery: (query: TQuery) => void;
  onRunQuery?: () => void;
  timeRange?: TimeRange;
  isLoadingHistory?: boolean;
  query?: TQuery;
}

export const SparkJoySection = <TQuery extends DataQuery>({
  datasource,
  history,
  onChangeQuery,
  onRunQuery,
  timeRange,
  isLoadingHistory = false,
  query,
}: SparkJoySectionProps<TQuery>) => {
  const theme = useTheme2();
  const [recentQueries, setRecentQueries] = useState<QueryItem[]>([]);
  const [isHidden, setIsHidden] = useState(false);
  const { setDrawerOpened } = useQueriesDrawerContext();
  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();
  const { openDrawer: openQueryHistoryDrawer, queryHistoryEnabled } = useQueryHistoryContext();
  const hasCheckedInitialQuery = useRef(false);
  
  // Check if we should hide the section based on existing query (only on first render)
  useEffect(() => {
    if (!hasCheckedInitialQuery.current && query) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
      const queryasany = query as any;
      if (queryasany && (queryasany.expr) && (queryasany.expr).length > 0) {
        setIsHidden(true);
      }
      hasCheckedInitialQuery.current = true;
    }
  }, [query]); // Depend on query so we can check it when it becomes available

  // Use the custom hook to fetch saved queries (similar to useListQueryQuery pattern)
  const {
    data: libraryQueries,
    isLoading: isLoadingLibraryQueries,
    error: libraryQueriesError
  } = useSavedQueries(queryLibraryEnabled ? datasource.name : undefined, 4);

  // Get query patterns for Loki and Prometheus datasources
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const { patterns: patternQueries, isLoading: isLoadingPatterns } = useQueryPatterns(datasource as unknown as DataSourceApi);


  useEffect(() => {
    // Process RichHistoryQuery items to get recent queries
    const genericRecentQueries = history
      .filter((item) => {
        // Filter for recent history items that have queries
        return item.queries && item.queries.length > 0 && item.queries[0];
      })
      // also remove duplicates based on query content
      .filter(
        (item, index, self) =>
          index === self.findIndex((t) => JSON.stringify(t.queries[0]) === JSON.stringify(item.queries[0]))
      )
      .slice(0, 4)
      .map((item, index) => {
        const firstQuery = item.queries[0];
        // Use datasource.getQueryDisplayText if available, otherwise extract query text manually
        return {
          title: `Recent Query ${index + 1}`,
          query: firstQuery,
          uid: item.id || `recent-${index}`,
          timestamp: item.createdAt,
        };
      });
    setRecentQueries(genericRecentQueries);
  }, [history, datasource]);

  const styles = {
    container: {
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(1),
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(2),
      gap: theme.spacing(1),
    },
    columnsContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing(3),
    },
    column: {
      minHeight: '200px',
    },
    columnHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    },
    emptyState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100px',
      color: theme.colors.text.secondary,
      fontStyle: 'italic' as const,
    },
    loadingState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(1),
      height: '100px',
      color: theme.colors.text.secondary,
    },
  };

  const handleQuerySelect = (query: TQuery) => {
    onChangeQuery(query);
    // Hide the SparkJoy section after selecting a query
    setIsHidden(true);
    // Auto-run the query after selecting it
    if (onRunQuery) {
      // Small delay to ensure the query is set before running
      setTimeout(onRunQuery, 100);
    }
  };

  const handleLibraryQuerySelect = (query: DataQuery) => {
    // Type assertion is safe here since TQuery extends DataQuery
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    handleQuerySelect(query as TQuery);
  };


  // Don't render the section if it's hidden
  if (isHidden) {
    return null;
  }

  return (
    <div className={css(styles.container)}>
      <div className={css(styles.columnsContainer)}>
        {/* Recommended Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
             {/* <Icon name="thumbs-up" size="md" /> */}
             <Text variant="h5">Recommended queries</Text>
          </div>

          {/* Combine pattern queries and library queries */}
          {isLoadingLibraryQueries || isLoadingPatterns ? (
            <div className={css(styles.loadingState)}>
              <Spinner size={16} />
              <span>Loading recommended queries...</span>
            </div>
          ) : libraryQueriesError ? (
            <div className={css(styles.emptyState)}>
              Error loading saved queries
            </div>
          ) : (
            <>
              {/* Show pattern queries first (for Loki/Prometheus) */}
              {patternQueries.length > 0 && (
                <Stack direction="column" gap={1}>
                  {patternQueries.map((query, index) => (
                    <QueryCard
                      key={`pattern-${query.uid || index}`}
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                      query={query as unknown as QueryItem}
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                      onClick={() => handleQuerySelect(query.query as TQuery)}
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
                      datasource={datasource as any}
                      timeRange={timeRange}
                      isRecentQuery={false}
                      timestamp={query.createdAt}
                    />
                  ))}
                </Stack>
              )}
              
              {/* Show library queries if query library is enabled */}
              {queryLibraryEnabled && libraryQueries.length > 0 && (
                <div style={{ marginTop: patternQueries.length > 0 ? theme.spacing(1) : 0 }}>
                  <Stack direction="column" gap={1}>
                    {libraryQueries.map((query, index) => (
                    <QueryCard
                      key={`library-${query.uid || index}-${query.userInfo ? 'with-user' : 'no-user'}`}
                      query={query}
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                      onClick={() => handleQuerySelect(query.query as TQuery)}
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
                      datasource={datasource as any}
                      timeRange={timeRange}
                      isRecentQuery={false}
                      timestamp={query.createdAt}
                    />
                    ))}
                  </Stack>
                </div>
              )}
              
              {/* Show empty state or browse button if no queries */}
              {patternQueries.length === 0 && libraryQueries.length === 0 && (
                <div>
                  <div className={css(styles.emptyState)}>
                    {queryLibraryEnabled ? 'No recommended queries found' : 'Query library not enabled'}
                  </div>
                  {queryLibraryEnabled && (
                    <Button
                      variant="secondary"
                      onClick={() => openQueryLibraryDrawer({
                        datasourceFilters: [datasource.name],
                        onSelectQuery: handleLibraryQuerySelect,
                        options: { context: 'explore' },
                      })}
                      size="md"
                      icon="book"
                    >
                      Browse saved queries
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Show more button */}
          {(patternQueries.length > 0 || libraryQueries.length > 0) && queryLibraryEnabled && (
            <button style={{ marginTop: theme.spacing(1), backgroundColor: theme.colors.background.primary, border: 'none', borderRadius: theme.shape.radius.default, cursor: 'pointer' }}
              onClick={() => openQueryLibraryDrawer({
                datasourceFilters: [datasource.name],
                onSelectQuery: handleLibraryQuerySelect,
                options: { context: 'explore' },
              })}>
              Show more
            </button>
          )}
        </div>

        {/* Recent Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
            {/* <Icon name="history" size="md" /> */}
            <Text variant="h5">My recent queries</Text>
          </div>

          {isLoadingHistory ? (
            <div className={css(styles.loadingState)}>
              <Spinner size={16} />
              <span>Loading recent queries...</span>
            </div>
          ) : recentQueries.length > 0 ? (
            <Stack direction="column" gap={1}>
              {recentQueries.map((query, index) => {
                return (
                  <QueryCard
                    key={query.uid || index}
                    query={query}
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
                    onClick={() => handleQuerySelect(query.query as TQuery)}
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
                    datasource={datasource as any}
                    timeRange={timeRange}
                    isRecentQuery={true}
                    timestamp={query.timestamp}
                  />
                );
              })}
              <div>
                <button 
                  style={{ 
                    marginTop: theme.spacing(1), 
                    backgroundColor: theme.colors.background.primary, 
                    border: 'none', 
                    borderRadius: theme.shape.radius.default, 
                    cursor: 'pointer' 
                  }}
                  onClick={() => {
                    if (queryHistoryEnabled) {
                      openQueryHistoryDrawer({
                        datasourceFilters: [datasource.name],
                        onSelectQuery: (query) => handleQuerySelect(query as TQuery),
                        options: { context: 'alerting' },
                      });
                    } else {
                      setDrawerOpened(true);
                    }
                  }}
                >
                  View all
                </button>
              </div>
            </Stack>
          ) : (
            <div className={css(styles.emptyState)}>No recent queries available</div>
          )}
        </div>
      </div>
    </div>
  );
};
