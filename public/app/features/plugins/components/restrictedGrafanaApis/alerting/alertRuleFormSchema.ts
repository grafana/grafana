import * as z from 'zod/mini';

import { RuleFormType } from 'app/features/alerting/unified/types/rule-form';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

// Combined schema that supports both regular and expression queries
export const alertingModelSchema = z.looseObject({
  refId: z.string(),
  maxDataPoints: z.optional(z.number()).check(z.describe('Maximum number of data points to return')),
  intervalMs: z.optional(z.number()).check(z.describe('Interval in milliseconds')),
});

// Main navigate to alert form schema - merged from both alertingSchemaApi and formDefaults
export const alertingAlertRuleFormSchema = z.object({
  // Common fields
  name: z.optional(z.string()).check(z.describe('Name of the alert rule')),
  type: z.catch(z.optional(z.enum(RuleFormType)), RuleFormType.grafana).check(z.describe('Type of the alert rule')),
  dataSourceName: z._default(z.string(), ''),
  group: z.optional(z.string()).check(z.describe('Alert group name')),

  // Labels and annotations
  labels: z
    ._default(
      z.array(
        z.object({
          key: z.string().check(z.describe('Label key')),
          value: z.string().check(z.describe('Label value')),
        })
      ),
      []
    )
    .check(z.describe('Labels for the alert rule')),
  annotations: z
    .optional(
      z.array(
        z.object({
          key: z
            .string()
            .check(
              z.describe('Annotation key; for dashboard panel annotations, use "__dashboardUid__" or "__panelId__"')
            ),
          value: z.string().check(z.describe('Annotation value')),
        })
      )
    )
    .check(
      z.describe(`Optional annotations for the alert rule. When creating alerts from a dashboard panel, include:
    - {"key": "__dashboardUid__", "value": "<dashboard-uid>"}
    - {"key": "__panelId__", "value": "<panel-id>"}
    These annotations link the alert back to the source dashboard and panel.`)
    ),

  // Folder configuration
  folder: z
    .optional(
      z.object({
        kind: z._default(z.enum(['folder']), 'folder'),
        uid: z.string().check(z.describe('Folder UID where the alert rule will be created')),
        title: z._default(z.string(), '').check(z.describe('Folder title')),
      })
    )
    .check(z.describe('Folder configuration for the alert rule')),

  // Queries
  queries: z
    ._default(
      z.array(
        z.object({
          refId: z.string().check(z.describe('Reference ID for the query (e.g., "A", "B", "C")')),
          queryType: z._default(z.string(), '').check(z.describe('Datasource-specific')),
          relativeTimeRange: z.optional(
            z.object({
              from: z.number().check(z.describe('Relative time from in seconds (e.g., 3600 for 1 hour)')),
              to: z.number().check(z.describe('Relative time to in seconds (usually 0 for "now")')),
            })
          ),
          datasourceUid: z.string().check(z.describe('Datasource UID for the query')),
          model: alertingModelSchema.check(z.describe('Query model containing the actual query configuration')),
        })
      ),
      []
    )
    .check(z.describe('Array of queries that form the alert rule')),

  // Alert rule configuration
  condition: z
    .optional(z.string())
    .check(z.describe('Reference ID of the query that acts as the condition (e.g., "C")')),
  noDataState: z.optional(z.enum(GrafanaAlertStateDecision)).check(z.describe('State when no data is available')),
  execErrState: z
    .optional(z.enum(GrafanaAlertStateDecision))
    .check(z.describe('State when there is an execution error')),
  evaluateEvery: z.optional(z.string()).check(z.describe('Evaluation interval')),
  evaluateFor: z.optional(z.string()).check(z.describe('Evaluation duration')),
  keepFiringFor: z.optional(z.string()).check(z.describe('Keep firing duration')),
  isPaused: z._default(z.boolean(), false).check(z.describe('Whether the rule is paused')),
  missingSeriesEvalsToResolve: z
    .optional(z.number())
    .check(
      z.describe(
        'Number of consecutive evaluation intervals a dimension must be missing before the alert instance is resolved'
      )
    ),

  // Manual routing and contact points
  manualRouting: z
    ._default(z.boolean(), true)
    .check(z.describe('Whether to use manual routing. If true, contactPoints are used.')),
  contactPoints: z
    ._default(
      z.record(
        z.string(),
        z.object({
          selectedContactPoint: z.string().check(z.describe('Selected contact point to send the alert to')),
          overrideGrouping: z.boolean().check(z.describe('Whether to override the default grouping')),
          groupBy: z.array(z.string()).check(z.describe('Group by labels')),
          overrideTimings: z.boolean().check(z.describe('Whether to override the default timings')),
          groupWaitValue: z.string().check(z.describe('Group wait value')),
          groupIntervalValue: z.string().check(z.describe('Group interval value')),
          repeatIntervalValue: z.string().check(z.describe('Repeat interval value')),
          muteTimeIntervals: z.array(z.string()).check(z.describe('Mute time intervals')),
          activeTimeIntervals: z.array(z.string()).check(z.describe('Active time intervals')),
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
    )
    .check(z.describe('Contact points configuration')),

  // Editor settings
  editorSettings: z
    ._default(
      z.object({
        simplifiedQueryEditor: z.boolean(),
        simplifiedNotificationEditor: z.boolean(),
      }),
      { simplifiedQueryEditor: true, simplifiedNotificationEditor: true }
    )
    .check(z.describe('Editor settings')),

  // Additional fields
  metric: z.optional(z.string()).check(z.describe('Metric name for Grafana recording rules')),
  targetDatasourceUid: z.optional(z.string()).check(z.describe('Target datasource UID for Grafana recording rules')),

  // Navigation
  returnTo: z.optional(z.string()).check(z.describe('Optional URL to return to after creating the alert')),
});

// Simple API that only exposes the navigate to alert rule form schema
export const alertingAlertRuleFormSchemaApi = {
  alertingAlertRuleFormSchema,
};
