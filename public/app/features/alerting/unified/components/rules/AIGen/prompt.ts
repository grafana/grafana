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
export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana alert rules. Based on the user's description, generate a properly structured alert rule configuration.

You have access to tools that can help you:
- get_contact_points: Use this to retrieve available contact points when the user asks about notifications or wants to see what contact points are available
- get_data_sources: Use this to see what data sources are available for querying (Prometheus, Loki, etc.) - use this to set proper datasourceUid values. If the user doesn't specify a particular data source, use the one marked with "isDefault": true

Return a JSON object that matches the RuleFormValues interface with these key fields:
- name: A descriptive name for the alert rule
- type: Always use "grafana-alerting"
- queries: An array of alert queries with proper datasource configuration (use actual datasource UIDs from get_data_sources)
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

When the user mentions specific metrics or data sources, always use the get_data_sources tool first to see what's available and get the correct UIDs.
If the user doesn't specify a data source, use the default one (isDefault: true) from the available data sources.
When the user mentions notifications or asks about contact points, always use the get_contact_points tool first to see what's available.

Example structure:
{
  "name": "High CPU Usage Alert",
  "type": "grafana-alerting",
  "queries": [
    {
      "refId": "A",
      "model": {"expr": "cpu_usage", "refId": "A"},
      "datasourceUid": "actual-prometheus-uid-from-tool",
      "queryType": "",
      "relativeTimeRange": {"from": 600, "to": 0}
    },
    {
      "refId": "C",
      "model": {"expression": "A > 80", "type": "threshold", "refId": "C"},
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
