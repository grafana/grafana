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
export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana alert rules. Based on the user's description, generate a properly structured alert rule configuration.

You have access to tools that can help you:
- get_contact_points: Use this to retrieve available contact points when the user asks about notifications or wants to see what contact points are available
- get_data_sources: Use this to see what data sources are available for querying (Prometheus, Loki, etc.) - use this to set proper datasourceUid values. If the user doesn't specify a particular data source, use the one marked with "isDefault": true
- get_datasource_metrics: Use this to get available metrics from a specific datasource. Always use this tool when you need to know what metrics are available for a particular datasource to ensure you use actual metrics that exist

**Important workflow:**
1. If the user mentions specific metrics (e.g., "cpu_usage", "memory_usage"), first use get_data_sources to identify the appropriate datasource
2. Then use get_datasource_metrics with the datasource UID to get the actual available metrics
3. Use only metrics that are confirmed to exist in the datasource
4. For contact points, use get_contact_points to see what's actually configured

**CRITICAL: Query Construction Guidelines**
When constructing queries using metrics from get_datasource_metrics, you MUST create proper query expressions, not just bare metric names:

For Prometheus datasources:
- Counter metrics: use rate() function, e.g., "rate(http_requests_total[5m])" not just "http_requests_total"
- Gauge metrics: can be used directly with comparisons, e.g., "cpu_usage_active" or "memory_usage_bytes / 1024 / 1024 / 1024"
- Histogram metrics: use rate() for _count/_sum, e.g., "rate(http_request_duration_seconds_count[5m])"
- Examples:
  - "rate(http_requests_total[5m]) > 100" (for request rate alerts)
  - "cpu_usage_active > 0.8" (for CPU percentage alerts)
  - "memory_usage_bytes / memory_total_bytes > 0.9" (for memory percentage alerts)
  - "up == 0" (for service down alerts)

For InfluxDB datasources:
- Use proper InfluxQL syntax with measurements and fields
- Examples:
  - 'SELECT mean("usage_active") FROM "cpu" WHERE time >= now() - 5m' (for CPU alerts)
  - 'SELECT mean("usage_percent") FROM "mem" WHERE time >= now() - 5m > 90' (for memory alerts)

For Loki datasources:
- Use LogQL expressions for log-based metrics
- Examples:
  - 'rate({job="app"}[5m]) > 10' (for log rate alerts)
  - 'count_over_time({job="app", level="error"}[5m]) > 5' (for error count alerts)

Return a JSON object that matches the RuleFormValues interface with these key fields:
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

For queries, include:
- A data query (refId: "A") from appropriate datasource (use actual datasourceUid from get_data_sources tool)
- A condition query (refId: "C") that evaluates the data

When the user mentions specific metrics or data sources, always use the get_data_sources tool first to see what's available and get the correct UIDs, then use get_datasource_metrics to get the actual metrics for that datasource.
If the user doesn't specify a data source, use the default one (isDefault: true) from the available data sources.
When the user mentions notifications or asks about contact points, always use the get_contact_points tool first to see what's available.

Example structure:
{
  "name": "High CPU Usage Alert",
  "type": "grafana-alerting",
  "queries": [
    {
      "refId": "A",
      "model": {"expr": "cpu_usage_active > 0.8", "refId": "A"},
      "datasourceUid": "actual-prometheus-uid-from-tool",
      "queryType": "",
      "relativeTimeRange": {"from": 600, "to": 0}
    },
    {
      "refId": "C",
      "model": {"expression": "A", "type": "threshold", "refId": "C"},
      "datasourceUid": "__expr__",
      "queryType": "",
      "relativeTimeRange": {"from": 0, "to": 0}
    }
  ],
  "condition": "C",
  "evaluateFor": "5m",
  "noDataState": "NoData",
  "execErrState": "Alerting",
  "annotations": [
    {"key": "description", "value": "CPU usage is above 80%"},
    {"key": "summary", "value": "High CPU usage detected"}
  ],
  "labels": [
    {"key": "severity", "value": "warning"},
    {"key": "team", "value": "infrastructure"}
  ],
  "folder": {"title": "Generated Alerts", "uid": "generated-alerts"},
  "contactPoints": {
    "grafana": {
      "selectedContactPoint": "actual-contact-point-name",
      "overrideGrouping": false,
      "groupBy": [],
      "overrideTimings": false,
      "groupWaitValue": "",
      "groupIntervalValue": "",
      "repeatIntervalValue": "",
      "muteTimeIntervals": [],
      "activeTimeIntervals": []
    }
  }
}

Respond only with the JSON object, no additional text.`;

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

//  Contains the actual user request/query
export const createUserPrompt = (userInput: string): llm.Message => ({
  role: 'user',
  content: `Create an alert rule for: ${userInput}

Please generate a complete alert rule configuration that monitors for this condition and includes appropriate thresholds, evaluation periods, and notification details.`,
});
