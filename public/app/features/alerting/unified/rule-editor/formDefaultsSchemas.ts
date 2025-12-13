import z from 'zod';

import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { RuleFormType } from '../types/rule-form';

// Schema for cloud rule form values. This is necessary because the cloud rule form values are not the same as the grafana rule form values.
// schema for grafana rule values is navigateToAlertFormSchema , shared in the restrictedGrafanaApis.
// TODO: add this to the DMA new plugin.

export const cloudRuleFormValuesSchema = z.looseObject({
  name: z.string().optional(),
  type: z.enum(RuleFormType).catch(RuleFormType.grafana),
  dataSourceName: z.string().optional().default(''),
  group: z.string().optional(),
  labels: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
  annotations: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
  queries: z.array(z.any()).optional(),
  condition: z.string().optional(),
  noDataState: z
    .enum(GrafanaAlertStateDecision)
    .optional()
    .default(GrafanaAlertStateDecision.NoData)
    .catch(GrafanaAlertStateDecision.NoData),
  execErrState: z
    .enum(GrafanaAlertStateDecision)
    .optional()
    .default(GrafanaAlertStateDecision.Error)
    .catch(GrafanaAlertStateDecision.Error),
  folder: z
    .union([
      z.object({
        title: z.string(),
        uid: z.string(),
      }),
      z.undefined(),
    ])
    .optional(),
  evaluateEvery: z.string().optional(),
  evaluateFor: z.string().optional().default('0s'),
  keepFiringFor: z.string().optional(),
  isPaused: z.boolean().optional().default(false),
  manualRouting: z.boolean().optional(),
  contactPoints: z
    .record(
      z.string(),
      z.object({
        selectedContactPoint: z.string(),
        overrideGrouping: z.boolean(),
        groupBy: z.array(z.string()),
        overrideTimings: z.boolean(),
        groupWaitValue: z.string(),
        groupIntervalValue: z.string(),
        repeatIntervalValue: z.string(),
        muteTimeIntervals: z.array(z.string()),
        activeTimeIntervals: z.array(z.string()),
      })
    )
    .optional(),
  editorSettings: z
    .object({
      simplifiedQueryEditor: z.boolean(),
      simplifiedNotificationEditor: z.boolean(),
    })
    .optional(),
  metric: z.string().optional(),
  targetDatasourceUid: z.string().optional(),
  namespace: z.string().optional(),
  expression: z.string().optional(),
  missingSeriesEvalsToResolve: z.number().optional(),
});
