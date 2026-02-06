/**
 * Schema Validation
 *
 * Provides Zod validators for mutation command payloads.
 * Only implemented commands have validators.
 */

import { z } from 'zod';

import type { MutationType } from '../types';

// DataLink schema
const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.boolean().optional(),
});

// DataQueryKind schema
const dataQueryKindSchema = z.object({
  kind: z.literal('DataQuery'),
  group: z.string(),
  version: z.string(),
  datasource: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  spec: z.record(z.string(), z.unknown()),
});

// FieldConfig schema for viz config
const fieldConfigSchema = z.object({
  defaults: z.record(z.string(), z.unknown()).optional(),
  overrides: z.array(z.any()).optional(),
});

// VizConfigKind schema
const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig'),
  group: z.string(),
  version: z.string().optional(),
  spec: z.object({
    options: z.record(z.string(), z.unknown()).optional(),
    fieldConfig: fieldConfigSchema.optional(),
  }),
});

// PanelQuery schema
const panelQuerySchema = z.object({
  kind: z.literal('PanelQuery'),
  spec: z.object({
    query: dataQueryKindSchema,
    refId: z.string(),
    hidden: z.boolean().optional(),
  }),
});

// QueryGroupKind schema
const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup'),
  spec: z.object({
    queries: z.array(panelQuerySchema).optional(),
    transformations: z.array(z.any()).optional(),
    queryOptions: z.any().optional(),
  }),
});

// PanelSpec schema
const panelSpecSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  links: z.array(dataLinkSchema).optional(),
  data: queryGroupKindSchema.optional(),
  vizConfig: vizConfigKindSchema,
  transparent: z.boolean().optional(),
});

// PanelKind schema
const panelKindSchema = z.object({
  kind: z.literal('Panel'),
  spec: panelSpecSchema,
});

// Grid position schema
const gridPositionSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// VariableKind schema
const variableKindSchema = z.object({
  kind: z.string(),
  spec: z.record(z.string(), z.unknown()),
});

// ADD_PANEL
export const addPanelPayloadSchema = z.object({
  panel: panelKindSchema,
  position: gridPositionSchema.optional(),
});

// REMOVE_PANEL
export const removePanelPayloadSchema = z
  .object({
    elementName: z.string().optional(),
    panelId: z.number().optional(),
  })
  .refine((data) => data.elementName !== undefined || data.panelId !== undefined, {
    message: 'Either elementName or panelId must be provided',
  });

// UPDATE_PANEL
export const updatePanelPayloadSchema = z
  .object({
    elementName: z.string().optional(),
    panelId: z.number().optional(),
    updates: panelSpecSchema.partial(),
  })
  .refine((data) => data.elementName !== undefined || data.panelId !== undefined, {
    message: 'Either elementName or panelId must be provided',
  });

// ADD_VARIABLE
export const addVariablePayloadSchema = z.object({
  variable: variableKindSchema,
  position: z.number().optional(),
});

// REMOVE_VARIABLE
export const removeVariablePayloadSchema = z.object({
  name: z.string(),
});

// UPDATE_VARIABLE
export const updateVariablePayloadSchema = z.object({
  name: z.string(),
  variable: variableKindSchema,
});

// LIST_VARIABLES (empty payload)
export const listVariablesPayloadSchema = z.object({}).strict();

// UPDATE_TIME_SETTINGS
export const updateTimeSettingsPayloadSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  timezone: z.string().optional(),
  autoRefresh: z.string().optional(),
  autoRefreshIntervals: z.array(z.string()).optional(),
  quickRanges: z.array(z.any()).optional(),
  hideTimepicker: z.boolean().optional(),
  weekStart: z.string().optional(),
  fiscalYearStartMonth: z.number().optional(),
  nowDelay: z.string().optional(),
});

// UPDATE_DASHBOARD_META
export const updateDashboardMetaPayloadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  editable: z.boolean().optional(),
  preload: z.boolean().optional(),
  liveNow: z.boolean().optional(),
});

// GET_DASHBOARD_INFO (empty payload)
export const getDashboardInfoPayloadSchema = z.object({}).strict();

// ENTER_EDIT_MODE (empty payload)
export const enterEditModePayloadSchema = z.object({}).strict();

// Validators for all implemented commands
const validators: Partial<Record<MutationType, z.ZodType>> = {
  ADD_PANEL: addPanelPayloadSchema,
  REMOVE_PANEL: removePanelPayloadSchema,
  UPDATE_PANEL: updatePanelPayloadSchema,
  ADD_VARIABLE: addVariablePayloadSchema,
  REMOVE_VARIABLE: removeVariablePayloadSchema,
  UPDATE_VARIABLE: updateVariablePayloadSchema,
  LIST_VARIABLES: listVariablesPayloadSchema,
  UPDATE_TIME_SETTINGS: updateTimeSettingsPayloadSchema,
  UPDATE_DASHBOARD_META: updateDashboardMetaPayloadSchema,
  GET_DASHBOARD_INFO: getDashboardInfoPayloadSchema,
  ENTER_EDIT_MODE: enterEditModePayloadSchema,
};

/**
 * Get the Zod validator for a command type.
 */
export function getValidator(commandType: string): z.ZodType | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return validators[commandType as MutationType] ?? null;
}

/**
 * Validate a payload against the schema for a command type.
 */
export function validatePayload(
  commandType: string,
  payload: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const validator = getValidator(commandType);
  if (!validator) {
    return { success: true, data: payload };
  }

  const result = validator.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { success: false, error: `Validation failed: ${errorMessages.join(', ')}` };
}
