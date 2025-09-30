/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { useEffect, useState } from 'react';

import { DataQuery, DataSourceApi } from '@grafana/data';

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

// Unified query item interface that matches SparkJoySection's QueryItem
export interface PatternQueryItem {
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

interface QueryPatternStarterProps {
  datasource: DataSourceApi;
}

// Custom hook to get query patterns with real label values for Loki and Prometheus datasources
export const useQueryPatterns = (datasource: DataSourceApi) => {
  const [patterns, setPatterns] = useState<PatternQueryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getPatterns = async () => {
      setIsLoading(true);
      try {
        let queryPatterns: QueryPattern[] = [];

        // Check if it's a Loki datasource
        if (datasource.type === 'loki') {
          // Get real label values from the datasource
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const lokiDatasource = datasource as unknown as { 
            languageProvider?: { 
              started: boolean; 
              start: () => Promise<void>; 
              getLabelKeys: () => string[]; 
              fetchLabelValues: (label: string) => Promise<string[]> 
            } 
          };
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
              description: `Find logs in ${labelName}="${labelValue}"`
            },
            {
              name: 'Count of logs',
              type: 'log',
              operations: [],
              queryString: `sum((count_over_time(${labelSelector}[$__auto])))`,
              description: `Count of logs in ${labelName}="${labelValue}"`
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
            },
            {
              name: 'Average metric value',
              type: 'aggregation',
              operations: [
                { id: 'avg', params: [] },
              ],
              queryString: `avg(${metricName})`,
              description: `Calculate the average value of ${metricName} across all instances`
            }
          ];
        }

        // Convert QueryPattern[] to PatternQueryItem[]
        const patternItems: PatternQueryItem[] = queryPatterns.map((pattern, index) => ({
          title: pattern.name,
          query: {
            refId: 'A',
            expr: pattern.queryString || (datasource.type === 'loki' ? '{}' : 'up'),
            datasource: datasource.getRef(),
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          } as unknown as DataQuery,
          uid: `pattern-${datasource.type}-${index}`,
          timestamp: Date.now(),
          createdBy: 'grafana',
          createdAt: Date.now(),
          userInfo: {
            displayName: 'Grafana',
            avatarURL: '', // Will be handled by the card component
          },
          isPattern: true,
          patternType: 'grafana',
        }));

        setPatterns(patternItems);
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

// Simple component that just returns the hook for external use
export const QueryPatternStarter = ({ datasource }: QueryPatternStarterProps) => {
  // This component now just exposes the hook functionality
  // The actual rendering is handled by SparkJoySection
  return null;
};
