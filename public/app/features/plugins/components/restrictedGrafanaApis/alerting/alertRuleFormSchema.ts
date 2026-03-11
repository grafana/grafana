import {
  type InferOutput,
  array,
  boolean as vBoolean,
  enum_ as vEnum,
  fallback,
  looseObject,
  metadata,
  number as vNumber,
  object,
  optional,
  picklist,
  pipe,
  record,
  string as vString,
} from 'valibot';

import { RuleFormType } from 'app/features/alerting/unified/types/rule-form';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

// Combined schema that supports both regular and expression queries
export const alertingModelSchema = looseObject({
  refId: vString(),
  maxDataPoints: pipe(optional(vNumber()), metadata({ description: 'Maximum number of data points to return' })),
  intervalMs: pipe(optional(vNumber()), metadata({ description: 'Interval in milliseconds' })),
});

// Main navigate to alert form schema - merged from both alertingSchemaApi and formDefaults
export const alertingAlertRuleFormSchema = object({
  // Common fields
  name: pipe(optional(vString()), metadata({ description: 'Name of the alert rule' })),
  type: pipe(
    fallback(optional(vEnum(RuleFormType)), RuleFormType.grafana),
    metadata({ description: 'Type of the alert rule' })
  ),
  dataSourceName: optional(vString(), ''),
  group: pipe(optional(vString()), metadata({ description: 'Alert group name' })),

  // Labels and annotations
  labels: pipe(
    optional(
      array(
        object({
          key: pipe(vString(), metadata({ description: 'Label key' })),
          value: pipe(vString(), metadata({ description: 'Label value' })),
        })
      ),
      []
    ),
    metadata({ description: 'Labels for the alert rule' })
  ),
  annotations: pipe(
    optional(
      array(
        object({
          key: pipe(
            vString(),
            metadata({
              description: 'Annotation key; for dashboard panel annotations, use "__dashboardUid__" or "__panelId__"',
            })
          ),
          value: pipe(vString(), metadata({ description: 'Annotation value' })),
        })
      )
    ),
    metadata({
      description: `Optional annotations for the alert rule. When creating alerts from a dashboard panel, include:
    - {"key": "__dashboardUid__", "value": "<dashboard-uid>"}
    - {"key": "__panelId__", "value": "<panel-id>"}
    These annotations link the alert back to the source dashboard and panel.`,
    })
  ),

  // Folder configuration
  folder: pipe(
    optional(
      object({
        kind: optional(picklist(['folder']), 'folder'),
        uid: pipe(vString(), metadata({ description: 'Folder UID where the alert rule will be created' })),
        title: pipe(optional(vString(), ''), metadata({ description: 'Folder title' })),
      })
    ),
    metadata({ description: 'Folder configuration for the alert rule' })
  ),

  // Queries
  queries: pipe(
    optional(
      array(
        object({
          refId: pipe(vString(), metadata({ description: 'Reference ID for the query (e.g., "A", "B", "C")' })),
          queryType: pipe(optional(vString(), ''), metadata({ description: 'Datasource-specific' })),
          relativeTimeRange: optional(
            object({
              from: pipe(vNumber(), metadata({ description: 'Relative time from in seconds (e.g., 3600 for 1 hour)' })),
              to: pipe(vNumber(), metadata({ description: 'Relative time to in seconds (usually 0 for "now")' })),
            })
          ),
          datasourceUid: pipe(vString(), metadata({ description: 'Datasource UID for the query' })),
          model: pipe(
            alertingModelSchema,
            metadata({ description: 'Query model containing the actual query configuration' })
          ),
        })
      ),
      []
    ),
    metadata({ description: 'Array of queries that form the alert rule' })
  ),

  // Alert rule configuration
  condition: pipe(
    optional(vString()),
    metadata({ description: 'Reference ID of the query that acts as the condition (e.g., "C")' })
  ),
  noDataState: pipe(
    optional(vEnum(GrafanaAlertStateDecision)),
    metadata({ description: 'State when no data is available' })
  ),
  execErrState: pipe(
    optional(vEnum(GrafanaAlertStateDecision)),
    metadata({ description: 'State when there is an execution error' })
  ),
  evaluateEvery: pipe(optional(vString()), metadata({ description: 'Evaluation interval' })),
  evaluateFor: pipe(optional(vString()), metadata({ description: 'Evaluation duration' })),
  keepFiringFor: pipe(optional(vString()), metadata({ description: 'Keep firing duration' })),
  isPaused: pipe(optional(vBoolean(), false), metadata({ description: 'Whether the rule is paused' })),
  missingSeriesEvalsToResolve: pipe(
    optional(vNumber()),
    metadata({
      description:
        'Number of consecutive evaluation intervals a dimension must be missing before the alert instance is resolved',
    })
  ),

  // Manual routing and contact points
  manualRouting: pipe(
    optional(vBoolean(), true),
    metadata({ description: 'Whether to use manual routing. If true, contactPoints are used.' })
  ),
  contactPoints: pipe(
    optional(
      record(
        vString(),
        object({
          selectedContactPoint: pipe(
            vString(),
            metadata({ description: 'Selected contact point to send the alert to' })
          ),
          overrideGrouping: pipe(vBoolean(), metadata({ description: 'Whether to override the default grouping' })),
          groupBy: pipe(array(vString()), metadata({ description: 'Group by labels' })),
          overrideTimings: pipe(vBoolean(), metadata({ description: 'Whether to override the default timings' })),
          groupWaitValue: pipe(vString(), metadata({ description: 'Group wait value' })),
          groupIntervalValue: pipe(vString(), metadata({ description: 'Group interval value' })),
          repeatIntervalValue: pipe(vString(), metadata({ description: 'Repeat interval value' })),
          muteTimeIntervals: pipe(array(vString()), metadata({ description: 'Mute time intervals' })),
          activeTimeIntervals: pipe(array(vString()), metadata({ description: 'Active time intervals' })),
        })
      ),
      {
        GRAFANA_RULES_SOURCE_NAME: {
          selectedContactPoint: 'default',
          overrideGrouping: false,
          groupBy: [],
          overrideTimings: false,
          groupWaitValue: '',
          groupIntervalValue: '',
          repeatIntervalValue: '',
          muteTimeIntervals: [],
          activeTimeIntervals: [],
        },
      }
    ),
    metadata({ description: 'Contact points configuration' })
  ),

  // Editor settings
  editorSettings: pipe(
    optional(
      object({
        simplifiedQueryEditor: vBoolean(),
        simplifiedNotificationEditor: vBoolean(),
      }),
      { simplifiedQueryEditor: true, simplifiedNotificationEditor: true }
    ),
    metadata({ description: 'Editor settings' })
  ),

  // Additional fields
  metric: pipe(optional(vString()), metadata({ description: 'Metric name for Grafana recording rules' })),
  targetDatasourceUid: pipe(
    optional(vString()),
    metadata({ description: 'Target datasource UID for Grafana recording rules' })
  ),

  // Navigation
  returnTo: pipe(optional(vString()), metadata({ description: 'Optional URL to return to after creating the alert' })),
});

// Export types for use in plugins
export type AlertingAlertRuleFormSchemaType = InferOutput<typeof alertingAlertRuleFormSchema>;
export type AlertingModelSchemaType = InferOutput<typeof alertingModelSchema>;

// Simple API that only exposes the navigate to alert rule form schema
export const alertingAlertRuleFormSchemaApi = {
  alertingAlertRuleFormSchema,
};
