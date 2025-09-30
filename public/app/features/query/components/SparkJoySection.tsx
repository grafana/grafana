/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

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
import { Stack, Text, Icon, useTheme2, Spinner, Avatar, Button } from '@grafana/ui';
import { RichHistoryQuery } from 'app/types/explore';

import { useQueriesDrawerContext } from '../../explore/QueriesDrawer/QueriesDrawerContext';
import { useQueryLibraryContext } from '../../explore/QueryLibrary/QueryLibraryContext';

// Query patterns imports
type LokiQueryPattern = {
  name: string;
  type: string;
  operations: Array<{ id: string; params: unknown[] }>;
};

type PromQueryPattern = {
  name: string;
  type: string;
  operations: Array<{ id: string; params: unknown[] }>;
  binaryQueries?: Array<{
    operator: string;
    query: {
      metric: string;
      labels: unknown[];
      operations: Array<{ id: string; params: unknown[] }>;
    };
  }>;
};

type QueryPattern = (LokiQueryPattern | PromQueryPattern) & {
  queryString?: string;
  description?: string;
};

// Interface for query items used in the SparkJoy section
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

// Custom hook to get query patterns with real label values for Loki and Prometheus datasources
const useQueryPatterns = (datasource: DataSourceApi) => {
  const [patterns, setPatterns] = useState<QueryPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getPatterns = async () => {
      setIsLoading(true);
      try {
        let queryPatterns: QueryPattern[] = [];

        // Check if it's a Loki datasource
        if (datasource.type === 'loki') {
          // Get real label values from the datasource
          const lokiDatasource = datasource as unknown as { languageProvider?: { started: boolean; getLabelKeys: () => string[]; fetchLabelValues: (label: string) => Promise<string[]> } };
          const languageProvider = lokiDatasource.languageProvider;
          
          let labelSelector = '{}'; // Default empty selector
          let labelName = 'job';
          let labelValue = 'default';

          if (languageProvider && languageProvider.started) {
            try {
              const labels = languageProvider.getLabelKeys() || [];
              const preferredLabels = ['job', 'app', 'k8s_app', 'service', 'container'];
              const preferredLabel = preferredLabels.find((l) => labels.includes(l));
              
              if (preferredLabel) {
                const values = await languageProvider.fetchLabelValues(preferredLabel);
                if (values && values.length > 0) {
                  labelName = preferredLabel;
                  labelValue = values[0]; // Use first available value
                  labelSelector = `{${preferredLabel}="${labelValue}"}`;
                }
              }
            } catch (error) {
              console.warn('Could not fetch label values, using defaults:', error);
            }
          }

          queryPatterns = [
            {
              name: 'Parse and filter logs',
              type: 'log',
              operations: [],
              queryString: `${labelSelector} |= "error" | json | level="error"`,
              description: `Find error logs in ${labelName}="${labelValue}" and parse them as JSON`
            }
          ];
        }
        // Check if it's a Prometheus datasource
        else if (datasource.type === 'prometheus') {
          // Get real metric names from the datasource
          let metricName = 'up'; // Default metric
          
          try {
            // For now, use a default metric - in a real implementation, you'd query the datasource
            // to get available metrics like: ['up', 'cpu_usage', 'memory_usage', 'http_requests_total']
            metricName = 'up';
          } catch (error) {
            console.warn('Could not fetch metrics, using default:', error);
          }

          queryPatterns = [
            {
              name: 'Rate and sum metric',
              type: 'rate',
              operations: [
                { id: 'rate', params: ['5m'] },
                { id: 'sum', params: [] },
              ],
              queryString: `sum(rate(${metricName}[5m]))`,
              description: `Calculate the rate of ${metricName} over 5 minutes and sum across all instances`
            }
          ];
        }

        setPatterns(queryPatterns);
      } catch (error) {
        console.error('Failed to load query patterns:', error);
        setPatterns([]);
      } finally {
        setIsLoading(false);
      }
    };

    getPatterns();
  }, [datasource]);

  return { patterns, isLoading };
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'Just now';
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
      return `1000+ ${unit} found`;
    }
    if (totalRows === 1) {
      return `1 ${unit} found`;
    }
    return `${totalRows.toLocaleString()} ${unit} found`;
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
      flexDirection: 'row' as const,
      gap: theme.spacing(2),
      alignItems: 'flex-start',
    },
    mainContent: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing(1),
      flex: 1,
    },
    rightSide: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing(1),
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    query: {
      fontFamily: theme.typography.fontFamilyMonospace,
      backgroundColor: theme.colors.background.canvas,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      wordBreak: 'break-all' as const,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
    },
    preview: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      minHeight: '20px',
    },
    previewIcon: {
      flexShrink: 0,
    },
    timestamp: {
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      textAlign: 'right' as const,
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
    },
    userName: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    },
  };
  console.log('query', query);
  const queryDisplayText = datasource?.getQueryDisplayText?.(query.query) ?? JSON.stringify(query.query);

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
          <div className={css(styles.query)}>{queryDisplayText}</div>

          <div className={css(styles.preview)}>
            {isLoading ? (
              <>
                <Spinner className={css(styles.previewIcon)} size={12} />
                <span>{getPreviewText()}</span>
              </>
            ) : (
              <>
                <Icon
                  name={previewData?.state === LoadingState.Error ? 'exclamation-triangle' : 'chart-line'}
                  size="sm"
                  className={css(styles.previewIcon)}
                />
                <span>{getPreviewText()}</span>
              </>
            )}
          </div>
        </div>
        {((isRecentQuery && timestamp) || (!isRecentQuery && (query.userInfo || query.createdAt))) && (
          <div className={css(styles.rightSide)}>
            <div className={css(styles.userInfo)}>
              <Avatar
                src={isRecentQuery ? config.bootData.user.gravatarUrl : (query.userInfo?.avatarURL || '')}
                alt={`${isRecentQuery ? config.bootData.user.name : query.userInfo?.displayName} avatar`}
                width={2}
                height={2}
              />
              <span className={css(styles.userName)}>
                {isRecentQuery ? 'You' : (query.userInfo?.displayName || 'Unknown user')}
              </span>
            </div>
            <div className={css(styles.timestamp)}>
              {isRecentQuery
                ? `Last run ${formatTimestamp(timestamp!)}`
                : `Created ${formatTimestamp(query.createdAt!)}`
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface QueryPatternCardProps {
  pattern: QueryPattern;
  onClick: () => void;
  datasource: DataSourceApi;
}

const QueryPatternCard = ({ pattern, onClick, datasource }: QueryPatternCardProps) => {
  const theme = useTheme2();

  const styles = {
    card: {
      cursor: 'pointer',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      marginBottom: 0,
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
    title: {
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    },
    description: {
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    },
    query: {
      fontFamily: theme.typography.fontFamilyMonospace,
      backgroundColor: theme.colors.background.canvas,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
      color: theme.colors.text.secondary,
    },
  };

  // Generate a query representation for display
  const getQueryDisplay = () => {
    // Use the pre-generated queryString if available
    if (pattern.queryString) {
      return pattern.queryString;
    }
    
    // Fallback to operations-based display
    if (datasource.type === 'loki') {
      return `{} | ${pattern.operations.map(op => op.id).join(' | ')}`;
    } else if (datasource.type === 'prometheus') {
      if ('binaryQueries' in pattern && pattern.binaryQueries && pattern.binaryQueries.length > 0) {
        return `metric | ${pattern.operations.map(op => op.id).join(' | ')} ${pattern.binaryQueries[0].operator} (...)`;
      }
      return `metric | ${pattern.operations.map(op => op.id).join(' | ')}`;
    }
    return pattern.name;
  };

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
        <div className={css(styles.title)}>{pattern.name}</div>
        <div className={css(styles.query)}>{getQueryDisplay()}</div>
        <div className={css(styles.description)}>
          {pattern.description || (datasource.type === 'loki' ? 'Loki query pattern' : 'Prometheus query pattern')}
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
}

export const SparkJoySection = <TQuery extends DataQuery>({
  datasource,
  history,
  onChangeQuery,
  onRunQuery,
  timeRange,
  isLoadingHistory = false,
}: SparkJoySectionProps<TQuery>) => {
  const theme = useTheme2();
  const [recentQueries, setRecentQueries] = useState<QueryItem[]>([]);
  const { setDrawerOpened } = useQueriesDrawerContext();
  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();

  // Use the custom hook to fetch saved queries (similar to useListQueryQuery pattern)
  const {
    data: libraryQueries,
    isLoading: isLoadingLibraryQueries,
    error: libraryQueriesError
  } = useSavedQueries(queryLibraryEnabled ? datasource.name : undefined, 4);

  // Get query patterns for Loki and Prometheus datasources
  const { patterns: queryPatterns, isLoading: isLoadingPatterns } = useQueryPatterns(datasource as unknown as DataSourceApi);

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

  const handlePatternSelect = (pattern: QueryPattern) => {
    try {
      // Use the pre-generated queryString if available, otherwise fallback to basic query
      const queryString = pattern.queryString || (datasource.type === 'loki' ? '{}' : 'up');
      
      const generatedQuery = {
        refId: 'A',
        expr: queryString,
        datasource: datasource.getRef(),
      };

      // Type assertion is safe here since TQuery extends DataQuery
      handleQuerySelect(generatedQuery as unknown as TQuery);
    } catch (error) {
      console.error('Failed to generate query from pattern:', error);
    }
  };

  return (
    <div className={css(styles.container)}>
      <div className={css(styles.columnsContainer)}>
        {/* Recommended Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
             {/* <Icon name="thumbs-up" size="md" /> */}
             <Text variant="h6">Recommended queries</Text>
          </div>

          {queryLibraryEnabled ? (
            <>
              {isLoadingLibraryQueries ? (
                <div className={css(styles.loadingState)}>
                  <Spinner size={16} />
                  <span>Loading saved queries...</span>
                </div>
              ) : libraryQueriesError ? (
                <div className={css(styles.emptyState)}>
                  Error loading saved queries
                </div>
              ) : libraryQueries.length > 0 ? (
                <Stack direction="column" gap={1}>
                  {libraryQueries.map((query, index) => (
                    <QueryCard
                      key={`${query.uid || index}-${query.userInfo ? 'with-user' : 'no-user'}`}
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
                  <div>
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
                      Browse all saved queries
                    </Button>
                  </div>
                </Stack>
              ) : (
                <div>
                  <div className={css(styles.emptyState)}>
                    No saved queries found
                  </div>
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
                </div>
              )}
            </>
          ) : (
            <div className={css(styles.emptyState)}>
              Query library not enabled
            </div>
          )}

          {/* Query Patterns Section - Show for Loki and Prometheus */}
          {(datasource.type === 'loki' || datasource.type === 'prometheus') && (
            <div style={{ marginTop: '24px' }}>
              <div className={css(styles.columnHeader)}>
                <Text variant="h6">Query starter</Text>
              </div>
              {isLoadingPatterns ? (
                <div className={css(styles.loadingState)}>
                  <Spinner size={16} />
                  <span>Loading query starter...</span>
                </div>
              ) : queryPatterns.length > 0 ? (
                <QueryPatternCard
                  pattern={queryPatterns[0]} // Show only the first (and only) pattern
                  onClick={() => handlePatternSelect(queryPatterns[0])}
                  datasource={datasource as unknown as DataSourceApi}
                />
              ) : (
                <div className={css(styles.emptyState)}>
                  No query starter available
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
            {/* <Icon name="history" size="md" /> */}
            <Text variant="h6">My recent queries</Text>
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
                <Button variant="secondary" onClick={() => setDrawerOpened(true)} size="md" icon="external-link-alt">
                  Show more
                </Button>
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
