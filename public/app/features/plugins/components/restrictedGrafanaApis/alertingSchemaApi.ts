import { z } from 'zod';

import { RuleFormType } from 'app/features/alerting/unified/types/rule-form';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

// Schema for __expr__ type queries (reduce, threshold, etc.)
export const exprQuerySchema = z.object({
  refId: z.string().describe('Reference ID for the query, e.g., "B", "C", etc.'),
  type: z.string().describe('Expression type, e.g., "reduce", "threshold", "math"'),
  datasource: z.object({
    uid: z.literal('__expr__').describe('Must be "__expr__" for expression queries'),
    type: z.literal('__expr__').describe('Must be "__expr__" for expression queries'),
  }),
  conditions: z
    .array(
      z.object({
        type: z.string().describe('Condition type, e.g., "query"'),
        evaluator: z.object({
          params: z.array(z.any()).describe('Parameters for the evaluator'),
          type: z.string().describe('Evaluator type, e.g., "gt", "lt", "within_range", "outside_range"'),
        }),
        operator: z.object({
          type: z.string().describe('Operator type, e.g., "and", "or"'),
        }),
        query: z.object({
          params: z.array(z.string()).describe('Query parameters, typically the refId to evaluate'),
        }),
        reducer: z.object({
          params: z.array(z.any()).describe('Parameters for the reducer'),
          type: z.string().describe('Reducer type, e.g., "last", "avg", "sum", "count", "min", "max"'),
        }),
      })
    )
    .optional()
    .describe('Conditions for the expression query'),
  reducer: z.string().optional().describe('Reducer function, e.g., "last", "avg", "sum"'),
  expression: z.string().optional().describe('Expression referencing other queries, e.g., "A"'),
  math: z.string().optional().describe('Math expression for math type queries'),
});

// Schema for regular datasource queries
export const alertingQuerySchema = z.object({
  refId: z.string().describe('Reference ID for the query, e.g., "A", "B", etc.'),
  expr: z.string().describe('Query expression to be executed. This can not include variables (e.g. $var).'),
  interval: z.string().default('1m').describe('Time interval for the query, e.g., "5m", "1h", "1d"'),
  datasource: z.object({
    type: z.string().describe('Datasource type, should be "prometheus", "loki", or "__expr__"'),
    uid: z.string().describe('Datasource UID'),
  }),
});

// Combined schema that supports both regular and expression queries
export const alertingModelSchema = z.union([alertingQuerySchema, exprQuerySchema]);

// Main navigate to alert form schema - merged from both alertingSchemaApi and formDefaults
export const navigateToAlertFormSchema = z.object({
  // Common fields
  name: z.string().optional().describe('Name of the alert rule'),
  type: z.enum(RuleFormType).optional().catch(RuleFormType.grafana).describe('Type of the alert rule'),
  dataSourceName: z.string().optional().default(''),
  group: z.string().optional().describe('Alert group name'),

  // Labels and annotations
  labels: z
    .array(
      z.object({
        key: z.string().describe('Label key'),
        value: z.string().describe('Label value'),
      })
    )
    .optional()
    .default([])
    .describe('Labels for the alert rule'),
  annotations: z
    .array(
      z.object({
        key: z
          .string()
          .describe('Annotation key; for dashboard panel annotations, use "__dashboardUid__" or "__panelId__"'),
        value: z.string().describe('Annotation value'),
      })
    )
    .optional().describe(`Optional annotations for the alert rule. When creating alerts from a dashboard panel, include:
    - {"key": "__dashboardUid__", "value": "<dashboard-uid>"}
    - {"key": "__panelId__", "value": "<panel-id>"}
    These annotations link the alert back to the source dashboard and panel.`),

  // Folder configuration
  folder: z
    .object({
      kind: z.enum(['folder']).default('folder'),
      uid: z.string().describe('Folder UID where the alert rule will be created'),
      title: z.string().optional().default('').describe('Folder title'),
    })
    .optional()
    .describe('Folder configuration for the alert rule'),

  // Queries
  queries: z
    .array(
      z.object({
        refId: z.string().describe('Reference ID for the query (e.g., "A", "B", "C")'),
        queryType: z.string().optional().default('instant').describe('Type of query (e.g., "instant")'),
        relativeTimeRange: z
          .object({
            from: z.number().describe('Relative time from in seconds (e.g., 3600 for 1 hour)'),
            to: z.number().default(0).describe('Relative time to in seconds (usually 0 for "now")'),
          })
          .optional(),
        datasourceUid: z.string().describe('Datasource UID for the query'),
        model: alertingModelSchema.describe('Query model containing the actual query configuration'),
      })
    )
    .optional()
    .describe('Array of queries that form the alert rule'),

  // Alert rule configuration
  condition: z.string().optional().describe('Reference ID of the query that acts as the condition (e.g., "C")'),
  noDataState: z.enum(GrafanaAlertStateDecision).optional().describe('State when no data is available'),
  execErrState: z.enum(GrafanaAlertStateDecision).optional().describe('State when there is an execution error'),
  evaluateEvery: z.string().optional().describe('Evaluation interval'),
  evaluateFor: z.string().optional().describe('Evaluation duration'),
  keepFiringFor: z.string().optional().describe('Keep firing duration'),
  isPaused: z.boolean().optional().default(false).describe('Whether the rule is paused'),

  // Manual routing and contact points
  manualRouting: z.boolean().optional().describe('Whether to use manual routing. If true, contactPoints are used.'),
  contactPoints: z
    .record(
      z.string(),
      z.object({
        selectedContactPoint: z.string().describe('Selected contact point to send the alert to'),
        overrideGrouping: z.boolean().describe('Whether to override the default grouping'),
        groupBy: z.array(z.string()).describe('Group by labels'),
        overrideTimings: z.boolean().describe('Whether to override the default timings'),
        groupWaitValue: z.string().describe('Group wait value'),
        groupIntervalValue: z.string().describe('Group interval value'),
        repeatIntervalValue: z.string().describe('Repeat interval value'),
        muteTimeIntervals: z.array(z.string()).describe('Mute time intervals'),
        activeTimeIntervals: z.array(z.string()).describe('Active time intervals'),
      })
    )
    .optional()
    .describe('Contact points configuration'),

  // Editor settings
  editorSettings: z
    .object({
      simplifiedQueryEditor: z.boolean(),
      simplifiedNotificationEditor: z.boolean(),
    })
    .optional()
    .describe('Editor settings'),

  // Additional fields
  metric: z.string().optional().describe('Metric name for Grafana recording rules'),
  targetDatasourceUid: z.string().optional().describe('Target datasource UID for Grafana recording rules'),
  namespace: z.string().optional().describe('Namespace for cloud rules'),
  forTime: z.number().optional().describe('For time duration'),
  forTimeUnit: z.string().optional().describe('For time unit'),
  keepFiringForTime: z.number().optional().describe('Keep firing for time duration'),
  keepFiringForTimeUnit: z.string().optional().describe('Keep firing for time unit'),
  expression: z.string().optional().describe('Expression for cloud rules'),
  missingSeriesEvalsToResolve: z.number().optional().describe('Missing series evaluations to resolve'),

  // Navigation
  returnTo: z.string().optional().describe('Optional URL to return to after creating the alert'),
});

// Export types for use in plugins
export type NavigateToAlertFormSchemaType = z.infer<typeof navigateToAlertFormSchema>;
export type AlertingQuerySchemaType = z.infer<typeof alertingQuerySchema>;
export type ExprQuerySchemaType = z.infer<typeof exprQuerySchema>;
export type AlertingModelSchemaType = z.infer<typeof alertingModelSchema>;

// Simple API that only exposes the navigate to alert form schema
export const navigateToAlertFormSchemaApi = {
  navigateToAlertFormSchema,
};
