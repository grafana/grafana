import { ContactPoint } from '@grafana/alerting/unstable';
import { llm } from '@grafana/llm';
import { getDataSourceSrv } from '@grafana/runtime';

import { ListMeta } from '../../../../../../../../packages/grafana-alerting/src/grafana/api/v0alpha1/api.gen';

export const GET_CONTACT_POINTS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_contact_points',
    description:
      'Retrieves a list of all contact points (notification receivers) configured in Grafana Alerting. Contact points define how and where alert notifications are sent.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Optional limit for the number of contact points to return',
          minimum: 1,
          maximum: 1000,
        },
      },
      required: [],
    },
  },
};

// Tool definition for getting available data sources
export const GET_DATA_SOURCES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_data_sources',
    description:
      'Retrieves a list of all data sources available for alerting. This includes Prometheus, Loki, InfluxDB, and other monitoring data sources that support alerting queries.',
    parameters: {
      type: 'object',
      properties: {
        alertingOnly: {
          type: 'boolean',
          description: 'Whether to only return data sources that support alerting',
          default: true,
        },
      },
      required: [],
    },
  },
};

// Tool definition for getting metrics from a specific datasource
export const GET_DATASOURCE_METRICS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_datasource_metrics',
    description:
      'Retrieves available metrics from a specific datasource. This helps identify what metrics can be used in alert queries for that datasource.',
    parameters: {
      type: 'object',
      properties: {
        datasourceUid: {
          type: 'string',
          description: 'The UID of the datasource to get metrics from',
        },
        limit: {
          type: 'number',
          description: 'Optional limit for the number of metrics to return (default: 100)',
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
        search: {
          type: 'string',
          description: 'Optional search term to filter metrics by name',
        },
      },
      required: ['datasourceUid'],
    },
  },
};
export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana alert rules. Generate properly structured alert rule configurations using available tools.

Available tools:
- get_contact_points: Retrieve available contact points
- get_data_sources: Get available datasources for querying
- get_datasource_metrics: Get actual metrics from specific datasources

Workflow:
1. Use get_data_sources to see available datasources
2. Select appropriate datasource based on user question:
   - Log-based alerts → Loki/Elasticsearch
   - Infrastructure metrics → Prometheus/InfluxDB  
   - Application metrics → Prometheus/InfluxDB
   - AWS/cloud metrics → CloudWatch
   - Container/K8s metrics → Prometheus
   - Default: use datasource marked "isDefault": true
3. Use get_datasource_metrics to get actual available metrics
4. Use get_contact_points for setting the contactPoints.grafana.selectedContactPoint:
  4.1: if user mentions a specific contact point, use that contact point if it exists in the get_contact_points tool
  4.2: if user mentions a type of contact point, use the first contact point that matches that type
  4.3: or default to the default contact point if nothing of the above is mentioned

Critical requirements:
- Always create proper query expressions with functions, operators, and thresholds
- Never use bare metric names without proper syntax (use PromQL for Prometheus, LogQL for Loki, InfluxQL for InfluxDB, CloudWatch for CloudWatch)
- Use actual datasource UIDs and metric names from tools
- Return only valid JSON matching RuleFormValues interface

Response structure:
- name, type: "grafana-alerting", queries, condition, evaluateFor, noDataState, execErrState
- annotations, labels, contactPoints (when specified)
- Do not set folder or group fields

Respond only with JSON, no additional text.`;

// Tool handler for getting contact points (now receives data as parameter)
export const handleGetContactPoints = async (
  args: unknown,
  contactPointsData:
    | {
        apiVersion?: string | undefined;
        kind?: string | undefined;
        metadata: ListMeta;
        items: ContactPoint[];
      }
    | undefined,
  isLoading: boolean
) => {
  try {
    if (isLoading) {
      return {
        success: false,
        error: 'Contact points are still loading',
        contactPoints: [],
        count: 0,
      };
    }

    const processedContactPoints =
      contactPointsData?.items.map((contactPoint) => ({
        name: contactPoint.spec.title,
        id: contactPoint.metadata.uid,
        provisioned: contactPoint.status.additionalFields?.provisioned,
        integrations: contactPoint.spec.integrations.map((integration) => ({
          type: integration.type,
          hasSettings: Object.keys(integration.settings || {}).length > 0,
        })),
        inUseByRoutes: contactPoint.status.operatorStates?.policies_count || 0,
        inUseByRules: contactPoint.status.operatorStates?.rules_count || 0,
      })) || [];

    return {
      success: true,
      contactPoints: processedContactPoints,
      count: processedContactPoints.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      contactPoints: [],
      count: 0,
    };
  }
};

// Tool handler for getting available data sources
export const handleGetDataSources = async (args: unknown) => {
  try {
    // Get all data sources that support alerting
    const dataSourceSrv = getDataSourceSrv();
    const alertingDataSources = dataSourceSrv.getList({ alerting: true });

    // Only extract what the AI actually needs
    const dataSources = alertingDataSources.map((ds) => ({
      name: ds.name,
      uid: ds.uid,
      type: ds.type,
      isDefault: ds.isDefault,
    }));

    return {
      success: true,
      dataSources,
      count: dataSources.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      dataSources: [],
      count: 0,
    };
  }
};

// Tool handler for getting metrics from a specific datasource
export const handleGetDatasourceMetrics = async (args: { datasourceUid: string; limit?: number; search?: string }) => {
  try {
    const { datasourceUid, limit = 50, search } = args; // Reduced default limit for better performance

    if (!datasourceUid) {
      return {
        success: false,
        error: 'datasourceUid is required',
        metrics: [],
        count: 0,
      };
    }

    // Get datasource info
    const dataSourceSrv = getDataSourceSrv();
    const datasources = dataSourceSrv.getList({ alerting: true });
    const datasourceInfo = datasources.find((ds) => ds.uid === datasourceUid);

    if (!datasourceInfo) {
      return {
        success: false,
        error: `Datasource with UID ${datasourceUid} not found`,
        metrics: [],
        count: 0,
      };
    }

    let metrics: string[] = [];
    let fetchedFromAPI = false;

    // Try to fetch real metrics from the datasource API
    try {
      const datasourceResult = await Promise.race([
        dataSourceSrv.get(datasourceUid),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Datasource fetch timeout')), 5000)),
      ]);

      // Check if datasource has metricFindQuery method and call it safely
      if (
        datasourceResult &&
        typeof datasourceResult === 'object' &&
        'metricFindQuery' in datasourceResult &&
        typeof datasourceResult.metricFindQuery === 'function'
      ) {
        if (datasourceInfo.type === 'prometheus') {
          try {
            // For Prometheus, get metric names via label values API
            const metricsResponse = await Promise.race([
              datasourceResult.metricFindQuery('label_values(__name__)'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Metrics query timeout')), 8000)),
            ]);

            if (Array.isArray(metricsResponse)) {
              const extractedMetrics: string[] = [];
              for (const item of metricsResponse) {
                if (item && typeof item === 'object') {
                  let metricName: string | undefined;
                  if ('text' in item && typeof item.text === 'string') {
                    metricName = item.text;
                  } else if ('value' in item && typeof item.value === 'string') {
                    metricName = item.value;
                  }
                  if (metricName) {
                    extractedMetrics.push(metricName);
                  }
                }
              }
              metrics = extractedMetrics.slice(0, 200); // Limit to prevent overwhelming the LLM
              fetchedFromAPI = true;
            }
          } catch (error) {
            console.warn('Failed to query Prometheus metrics:', error);
          }
        } else if (datasourceInfo.type === 'influxdb') {
          try {
            // For InfluxDB, try to get measurements
            const metricsResponse = await Promise.race([
              datasourceResult.metricFindQuery('SHOW MEASUREMENTS LIMIT 100'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Metrics query timeout')), 8000)),
            ]);

            if (Array.isArray(metricsResponse)) {
              const extractedMetrics: string[] = [];
              for (const item of metricsResponse) {
                if (item && typeof item === 'object') {
                  let metricName: string | undefined;
                  if ('text' in item && typeof item.text === 'string') {
                    metricName = item.text;
                  } else if ('value' in item && typeof item.value === 'string') {
                    metricName = item.value;
                  }
                  if (metricName) {
                    extractedMetrics.push(metricName);
                  }
                }
              }
              metrics = extractedMetrics.slice(0, 100);
              fetchedFromAPI = true;
            }
          } catch (error) {
            console.warn('Failed to query InfluxDB metrics:', error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch real metrics from ${datasourceInfo.type} datasource:`, error);
      // Will fall back to predefined metrics below
    }

    // Fall back to predefined metrics if API fetch failed or returned no results
    if (!fetchedFromAPI || metrics.length === 0) {
      console.log(`Using predefined metrics for ${datasourceInfo.type} datasource`);

      if (datasourceInfo.type === 'prometheus') {
        metrics = [
          'up',
          'cpu_usage_idle',
          'cpu_usage_active',
          'cpu_usage_system',
          'cpu_usage_user',
          'memory_usage_bytes',
          'memory_available_bytes',
          'memory_total_bytes',
          'disk_usage_bytes',
          'disk_available_bytes',
          'disk_total_bytes',
          'network_bytes_total',
          'network_bytes_recv',
          'network_bytes_sent',
          'http_requests_total',
          'http_request_duration_seconds',
          'http_request_duration_seconds_bucket',
          'http_request_duration_seconds_count',
          'http_request_duration_seconds_sum',
          'process_cpu_seconds_total',
          'process_resident_memory_bytes',
          'process_virtual_memory_bytes',
          'go_memstats_alloc_bytes',
          'go_memstats_heap_alloc_bytes',
          'go_memstats_heap_inuse_bytes',
          'go_goroutines',
          'node_cpu_seconds_total',
          'node_memory_MemAvailable_bytes',
          'node_memory_MemTotal_bytes',
          'node_filesystem_avail_bytes',
          'node_filesystem_size_bytes',
          'node_load1',
          'node_load5',
          'node_load15',
        ];
      } else if (datasourceInfo.type === 'loki') {
        metrics = [
          'rate({job="app"}[5m])',
          'count_over_time({job="app"}[5m])',
          'bytes_rate({job="app"}[5m])',
          'bytes_over_time({job="app"}[5m])',
          'sum(rate({job="app"}[5m]))',
          'sum(count_over_time({job="app", level="error"}[5m]))',
          'sum(count_over_time({job="app", level="warn"}[5m]))',
          'sum by (job) (rate({job=~".+"}[5m]))',
          'sum by (level) (count_over_time({job="app"}[5m]))',
        ];
      } else if (datasourceInfo.type === 'influxdb') {
        metrics = [
          'cpu',
          'cpu.usage_active',
          'cpu.usage_idle',
          'cpu.usage_system',
          'cpu.usage_user',
          'mem',
          'mem.usage_percent',
          'mem.available_percent',
          'mem.used_percent',
          'disk',
          'disk.usage_percent',
          'disk.free',
          'disk.used',
          'net',
          'net.bytes_recv',
          'net.bytes_sent',
          'system',
          'system.load1',
          'system.load5',
          'system.load15',
          'processes',
          'processes.total',
          'swap',
          'swap.usage_percent',
          'kernel',
          'kernel.boot_time',
        ];
      } else if (datasourceInfo.type === 'cloudwatch') {
        metrics = [
          'CPUUtilization',
          'MemoryUtilization',
          'DiskReadOps',
          'DiskWriteOps',
          'NetworkIn',
          'NetworkOut',
          'StatusCheckFailed',
          'StatusCheckFailed_Instance',
          'StatusCheckFailed_System',
        ];
      } else if (datasourceInfo.type === 'elasticsearch') {
        metrics = [
          'elasticsearch_cluster_health_status',
          'elasticsearch_cluster_health_number_of_nodes',
          'elasticsearch_cluster_health_active_primary_shards',
          'elasticsearch_indices_docs_count',
          'elasticsearch_indices_store_size_bytes',
          'elasticsearch_jvm_memory_used_bytes',
          'elasticsearch_jvm_memory_max_bytes',
        ];
      } else {
        // Generic metrics for other datasource types
        metrics = [
          'cpu_usage',
          'memory_usage',
          'disk_usage',
          'network_usage',
          'response_time',
          'error_rate',
          'throughput',
        ];
      }
    }

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      metrics = metrics.filter((metric) => metric.toLowerCase().includes(searchTerm));
    }

    // Apply limit
    const limitedMetrics = metrics.slice(0, limit);

    return {
      success: true,
      datasource: {
        uid: datasourceUid,
        name: datasourceInfo.name,
        type: datasourceInfo.type,
      },
      metrics: limitedMetrics,
      count: limitedMetrics.length,
      totalCount: metrics.length,
      fetchedFromAPI, // Indicates whether metrics were fetched from API or are predefined
    };
  } catch (error) {
    console.error('Error in handleGetDatasourceMetrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metrics: [],
      count: 0,
    };
  }
};

// Sets up the AI's behavior and context
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

//  Contains the actual user request/query with examples
export const createUserPrompt = (userInput: string): llm.Message => ({
  role: 'user',
  content: `Create an alert rule for: ${userInput}

FOR THE QUERY ARRAY:
- use the datasourceuid from the get_data_sources tool: 
  - 1- if user mentions a specific datasource, use that uid if you can find it, 
  - 2- if the user mentions a type of datasource, use the first data source that matches that type
  - 3- or default to the default datasource if nothing of the above is mentioned
- use the metric names from the get_datasource_metrics tool: 
  - 1- only use metrics that are confirmed to exist in the datasource, or the first 100 metrics if the user doesn't specify a metric
  - 2- if the user mentions a specific metric, and it exists in the datasource, use that metric
  - 3- or use a similar metric that exists in the datasource
- use the proper query syntax in the queries array based on datasource type:
- refId "A": Data query from datasource using proper syntax above
- refId "B": Reduce expression that reduces the data to a single value
- refId "C": Condition expression that evaluates the data

SUPER IMPORTANT: NEVER use bare metric names without proper syntax (use PromQL for Prometheus, LogQL for Loki, InfluxQL for InfluxDB, CloudWatch for CloudWatch)
For example, for prometheus, use "rate(http_requests_total[5m])" not just "http_requests_total"
THIS IS WRONG:
sum(rate(go_cpu_classes_total_cpu_seconds_total[5m])) by (instance) > 0.8
THIS IS CORRECT:
sum(rate(go_cpu_classes_total_cpu_seconds_total{job="grafana"}[5m])) by (instance) > 0.8
this is also correct:
sum(rate(go_cpu_classes_total_cpu_seconds_total{}[5m])) by (instance) > 0.8

IMPORTANT: Use proper query syntax in the queries array based on datasource type:

For Prometheus datasources:
- Always use proper PromQL syntax with label selectors when needed
- Counter metrics: use rate() function, e.g., "rate(http_requests_total[5m])" not just "http_requests_total"
- Gauge metrics: use with proper label selectors, e.g., "cpu_usage_active{instance=~\\".*\\"}" or "memory_usage_bytes / memory_total_bytes"
- Service availability: use "up{job=\\"service-name\\"}" not bare metrics
- NEVER create bare metric comparisons like "METRIC_NAME < value" (or any other comparison). Always include proper context.

Valid PromQL Examples:
- "rate(http_requests_total[5m]) > 100" (for request rate alerts)
- "cpu_usage_active{instance=~\\".*\\"} > 0.8" (for CPU percentage alerts)
- "(memory_usage_bytes / memory_total_bytes) * 100 > 90" (for memory percentage alerts)
- "up{job=\\"grafana\\"} == 0" (for service down alerts)
- "increase(error_count_total[5m]) > 10" (for error count alerts)
- "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5" (for latency alerts)

For Loki datasources:
- Use LogQL expressions for log-based metrics
- Examples:
  - "rate({job=\\"app\\"}[5m]) > 10" (for log rate alerts)
  - "count_over_time({job=\\"app\\", level=\\"error\\"}[5m]) > 5" (for error count alerts)
  - "sum(rate({job=\\"app\\"}[5m])) > 10" (for aggregated log rates)

For InfluxDB datasources:
- Use proper InfluxQL syntax with measurements and fields
- Examples:
  - "SELECT mean(\\"usage_active\\") FROM \\"cpu\\" WHERE time >= now() - 5m" (for CPU alerts)
  - "SELECT mean(\\"usage_percent\\") FROM \\"mem\\" WHERE time >= now() - 5m > 90" (for memory alerts)

Query structure requirements:
- refId "A": Data query from datasource using proper syntax above
- refId "B": Reduce expression that reduces the data to a single value
- refId "C": Condition expression that evaluates the data
- Use actual datasource UIDs from get_data_sources tool
- Use actual metric names from get_datasource_metrics tool

When returning the JSON object, return a JSON object that matches the RuleFormValues interface with these key fields:
- name: A descriptive name for the alert rule
- type: Always use "grafana-alerting"
- queries: An array of alert queries with proper datasource configuration (use actual datasource UIDs from get_data_sources), 
in this queries, construct proper query expressions using the metrics from get_datasource_metrics. DO NOT use bare metric names - always create proper expressions with operators, functions, and thresholds.
- condition: The refId of the query condition (usually "C")
- evaluateFor: How long the condition must be true (e.g., "5m")
- noDataState: What to do when no data (usually "NoData")
- execErrState: What to do on execution error (usually "Alerting")
- annotations: Array of key-value pairs for additional information
- labels: Array of key-value pairs for categorization
- folder: do not set this field
- group: do not set this field
- contactPoints: Use actual contact point names from the get_contact_points tool when available. Include all required routing settings:
  - selectedContactPoint: The contact point name
  - overrideGrouping: false (unless specifically requested)
  - groupBy: [] (empty array unless custom grouping requested)
  - overrideTimings: false (unless custom timing requested)
  - groupWaitValue: "" (empty unless overrideTimings is true)
  - groupIntervalValue: "" (empty unless overrideTimings is true)
  - repeatIntervalValue: "" (empty unless overrideTimings is true)
  - muteTimeIntervals: [] (array of mute timing names)
  - activeTimeIntervals: [] (array of active timing names)

Example JSON structure:
{
    "name": "lots of instances rule",
    "uid": "",
    "labels": [
        {
            "key": "",
            "value": ""
        }
    ],
    "annotations": [
        {
            "key": "summary",
            "value": "this is the summary"
        },
        {
            "key": "description",
            "value": "and this is the description"
        },
        {
            "key": "runbook_url",
            "value": "http://localhost:3000/d/d0c2e22f-1e6c-47fb-b534-601788d2d866/test-dashboard-with-alert?orgId=1"
        }
    ],
    "dataSourceName": "grafana",
    "type": "grafana-alerting",
    "group": "gr1",
    "folder": {
        "title": "adpcguv93h62od",
        "uid": "adpcguv93h62od"
    },
    "queries": [
        {
            "refId": "A",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "gdev-prometheus",
            "model": {
                "datasource": {
                    "type": "prometheus",
                    "uid": "gdev-prometheus"
                },
                "editorMode": "code",
                "expr": "rate(grafana_http_request_duration_seconds_bucket{}[1m])",
                "instant": true,
                "intervalMs": 1000,
                "legendFormat": "__auto",
                "maxDataPoints": 43200,
                "range": false,
                "refId": "A"
            }
        },
        {
            "refId": "B",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "B"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "A",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "reducer": "last",
                "refId": "B",
                "type": "reduce"
            }
        },
        {
            "refId": "C",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [
                                0
                            ],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "C"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "B",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "C",
                "type": "threshold"
            }
        }
    ],
    "recordingRulesQueries": [],
    "condition": "C",
    "noDataState": "NoData",
    "execErrState": "Error",
    "evaluateFor": "1m",
    "keepFiringFor": "0s",
    "evaluateEvery": "10s",
    "manualRouting": true,
    "contactPoints": {
        "grafana": {
            "selectedContactPoint": "cp1",
            "muteTimeIntervals": [],
            "activeTimeIntervals": [],
            "overrideGrouping": false,
            "overrideTimings": false,
            "groupBy": [],
            "groupWaitValue": "",
            "groupIntervalValue": "",
            "repeatIntervalValue": ""
        }
    },
    "overrideGrouping": false,
    "overrideTimings": false,
    "muteTimeIntervals": [],
    "editorSettings": {
        "simplifiedQueryEditor": true,
        "simplifiedNotificationEditor": false
    },
    "namespace": "",
    "expression": "",
    "forTime": 1,
    "forTimeUnit": "m",
    "isPaused": false
}
Generate a complete alert rule configuration using the available tools to get actual datasources, metrics, and contact points.`,
});
