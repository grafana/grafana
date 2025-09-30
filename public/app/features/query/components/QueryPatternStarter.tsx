/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { DataQuery, DataSourceApi } from '@grafana/data';
import { Spinner, useTheme2, Badge } from '@grafana/ui';

// Query patterns types
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

interface QueryPatternStarterProps {
  datasource: DataSourceApi;
  onSelectQuery: (query: DataQuery) => void;
}

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
          const lokiDatasource = datasource as unknown as { languageProvider?: { started: boolean; start: () => Promise<void>; getLabelKeys: () => string[]; fetchLabelValues: (label: string) => Promise<string[]> } };
          const languageProvider = lokiDatasource.languageProvider;
          
          let labelSelector = '{}'; // Default empty selector
          let labelName = 'job';
          let labelValue = 'default';

          if (languageProvider) {
            try {
              await languageProvider.start();
              const labels = languageProvider.getLabelKeys() || [];
              const preferredLabels = ['instance', 'job', 'app', 'cluster', 'service_name'];
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
              name: 'Search for logs',
              type: 'log',
              operations: [],
              queryString: `${labelSelector}`,
              description: `Find error logs in ${labelName}="${labelValue}"`
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
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: theme.spacing(0.5),
    },
    badge: {
      fontSize: theme.typography.bodySmall.fontSize,
      padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
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
        <div className={css(styles.query)}>{getQueryDisplay()}</div>
        <div className={css(styles.footer)}>
          <Badge 
            text="Recommended by Grafana" 
            color="blue" 
            className={css(styles.badge)}
          />
        </div>
      </div>
    </div>
  );
};

export const QueryPatternStarter = ({ datasource, onSelectQuery }: QueryPatternStarterProps) => {
  const theme = useTheme2();
  const { patterns: queryPatterns, isLoading: isLoadingPatterns } = useQueryPatterns(datasource);

  const styles = {
    container: {
      marginTop: '8px',
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

  const handlePatternSelect = (pattern: QueryPattern) => {
    try {
      // Use the pre-generated queryString if available, otherwise fallback to basic query
      const queryString = pattern.queryString || (datasource.type === 'loki' ? '{}' : 'up');
      
      const generatedQuery = {
        refId: 'A',
        expr: queryString,
        datasource: datasource.getRef(),
      };

      onSelectQuery(generatedQuery as unknown as DataQuery);
    } catch (error) {
      console.error('Failed to generate query from pattern:', error);
    }
  };

  // Only render for Loki and Prometheus datasources
  if (datasource.type !== 'loki' && datasource.type !== 'prometheus') {
    return null;
  }

  return (
    <div className={css(styles.container)}>
      {isLoadingPatterns ? (
        <div className={css(styles.loadingState)}>
          <Spinner size={16} />
          <span>Loading query starter...</span>
        </div>
      ) : queryPatterns.length > 0 ? (
        <QueryPatternCard
          pattern={queryPatterns[0]} // Show only the first (and only) pattern
          onClick={() => handlePatternSelect(queryPatterns[0])}
          datasource={datasource}
        />
      ) : (
        <div className={css(styles.emptyState)}>
          No query starter available
        </div>
      )}
    </div>
  );
};
