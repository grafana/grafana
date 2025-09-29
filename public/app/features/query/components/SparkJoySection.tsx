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
  DataQuery 
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { Stack, Text, Icon, useTheme2, Spinner, Avatar, Button } from '@grafana/ui';

import { RichHistoryQuery } from 'app/types/explore';

import { useQueriesDrawerContext } from '../../explore/QueriesDrawer/QueriesDrawerContext';

// Interface for query items used in the SparkJoy section
interface QueryItem {
  title: string;
  query: DataQuery;
  uid: string;
  timestamp?: number;
}

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


const QueryCard = ({ 
  query, 
  onClick, 
  datasource, 
  timeRange, 
  isRecentQuery, 
  timestamp 
}: QueryCardProps) => {
  const theme = useTheme2();
  const [previewData, setPreviewData] = useState<PanelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPreviewData = async () => {
      if (!query || typeof query !== 'object' || query === null || !query.query) {
        return;
      }
      
      // Use a default time range if none provided (last 1 hour)
      const effectiveTimeRange = timeRange || {
        from: dateTime(Date.now() - 60 * 60 * 1000),
        to: dateTime(),
        raw: { from: 'now-1h', to: 'now' }
      };
      
      setIsLoading(true);
      try {
        const uniqueId = Math.random().toString(36).substring(2, 15);
        
        // Create a generic query object - each datasource will need to adapt this
        const target = {
          ...query.query,
          refId: `sparkjoy-${uniqueId}`,
          datasource: datasource.getRef(),
        } 
        

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
       const result = 'toPromise' in observable 
         // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
         ? await (observable as { toPromise(): Promise<any> }).toPromise() 
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
                  name={
                    previewData?.state === LoadingState.Error 
                      ? 'exclamation-triangle' 
                      : 'chart-line'
                  } 
                  size="sm" 
                  className={css(styles.previewIcon)}
                />
                <span>{getPreviewText()}</span>
              </>
            )}
          </div>
        </div>
        
        {isRecentQuery && timestamp && (
          <div className={css(styles.rightSide)}>
            <div className={css(styles.userInfo)}>
              <Avatar 
                src={config.bootData.user.gravatarUrl} 
                alt={`${config.bootData.user.name} avatar`} 
                width={2} 
                height={2} 
              />
              <span className={css(styles.userName)}>You</span>
            </div>
            <div className={css(styles.timestamp)}>
              Last run {formatTimestamp(timestamp)}
            </div>
          </div>
        )}
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

  useEffect(() => {
    // Process RichHistoryQuery items to get recent queries
    const genericRecentQueries = history
      .filter((item) => {
        // Filter for recent history items that have queries
        return item.queries && item.queries.length > 0 && item.queries[0];
      })
       // also remove duplicates based on query content
       .filter((item, index, self) =>
         index === self.findIndex((t) => 
           JSON.stringify(t.queries[0]) === JSON.stringify(item.queries[0])
         )
       )
      .slice(0,4)
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

  return (
    <div className={css(styles.container)}>
      <div className={css(styles.columnsContainer)}>
        {/* Recommended Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
            <Icon name="thumbs-up" size="md" />
            <Text variant="h5">Recommended queries</Text>
          </div>
        </div>

        {/* Recent Queries Column */}
        <div className={css(styles.column)}>
          <div className={css(styles.columnHeader)}>
            <Icon name="history" size="md" />
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
            )})}
            <div>
             <Button variant="secondary" onClick={() => setDrawerOpened(true)} size="md" icon="external-link-alt">Show more</Button>
             </div>
            </Stack>
          ) : (
            <div className={css(styles.emptyState)}>
              No recent queries available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

