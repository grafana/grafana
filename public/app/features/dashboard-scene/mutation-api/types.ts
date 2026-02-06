/**
 * Dashboard Mutation API - Core Types
 *
 * This module defines the types for the Dashboard Mutation API.
 * Only types for implemented commands are included.
 */

import type {
  DataLink,
  QueryGroupKind,
  VizConfigKind,
  VariableKind,
  TimeSettingsSpec,
} from '@grafana/schema/src/schema/dashboard/v2beta1/types.spec.gen';

/**
 * Single source of truth for all valid mutation types.
 * The MutationType union is derived from this array.
 */
export const MUTATION_TYPES = [
  // Panel operations
  'ADD_PANEL',
  'REMOVE_PANEL',
  'UPDATE_PANEL',
  // Variable operations
  'ADD_VARIABLE',
  'REMOVE_VARIABLE',
  'UPDATE_VARIABLE',
  'LIST_VARIABLES',
  // Dashboard settings
  'UPDATE_TIME_SETTINGS',
  'UPDATE_DASHBOARD_META',
  // Read-only operations
  'GET_DASHBOARD_INFO',
  // Edit mode
  'ENTER_EDIT_MODE',
] as const;

export type MutationType = (typeof MUTATION_TYPES)[number];

/**
 * Panel spec for creation.
 * Only title and vizConfig are required; other fields have defaults.
 */
export type AddPanelSpec = {
  title: string;
  description?: string;
  links?: DataLink[];
  data?: QueryGroupKind;
  vizConfig: VizConfigKind;
  transparent?: boolean;
};

/**
 * Payload for adding a panel.
 * Uses PanelKind structure from the v2beta1 schema.
 */
export interface AddPanelPayload {
  /** The panel definition using PanelKind structure. */
  panel: {
    kind: 'Panel';
    spec: AddPanelSpec;
  };
  /** Position in the layout grid */
  position?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

export interface RemovePanelPayload {
  /** Element name in the elements map */
  elementName?: string;
  /** Alternative: Panel ID */
  panelId?: number;
}

/**
 * Payload for updating a panel.
 * Only the fields provided will be updated; others remain unchanged.
 */
export interface UpdatePanelPayload {
  /** Element name to identify the panel */
  elementName?: string;
  /** Alternative: Panel ID (numeric) */
  panelId?: number;
  /** Updates to apply - partial spec */
  updates: Partial<AddPanelSpec>;
}

/**
 * Payload for adding a variable.
 * Uses VariableKind from schema directly.
 */
export interface AddVariablePayload {
  /** The complete variable definition from v2 schema */
  variable: VariableKind;
  /** Position in the variables array (optional, appends if not specified) */
  position?: number;
}

export interface RemoveVariablePayload {
  /** Variable name to remove */
  name: string;
}

export interface UpdateVariablePayload {
  /** Variable name to update */
  name: string;
  /** The updated variable definition - replaces the existing one */
  variable: VariableKind;
}

/**
 * Payload for updating time settings.
 * Uses TimeSettingsSpec from schema.
 */
export type UpdateTimeSettingsPayload = Partial<TimeSettingsSpec>;

/**
 * Payload for updating dashboard metadata.
 */
export interface UpdateDashboardMetaPayload {
  title?: string;
  description?: string;
  tags?: string[];
  editable?: boolean;
  preload?: boolean;
  liveNow?: boolean;
}

/**
 * Internal mutation representation.
 * Handlers receive `unknown` and validate/cast internally.
 */
export interface Mutation {
  type: MutationType;
  payload: unknown;
}

export interface MutationPayloadMap {
  ADD_PANEL: AddPanelPayload;
  REMOVE_PANEL: RemovePanelPayload;
  UPDATE_PANEL: UpdatePanelPayload;
  ADD_VARIABLE: AddVariablePayload;
  REMOVE_VARIABLE: RemoveVariablePayload;
  UPDATE_VARIABLE: UpdateVariablePayload;
  LIST_VARIABLES: Record<string, never>;
  UPDATE_TIME_SETTINGS: UpdateTimeSettingsPayload;
  UPDATE_DASHBOARD_META: UpdateDashboardMetaPayload;
  GET_DASHBOARD_INFO: Record<string, never>;
  ENTER_EDIT_MODE: Record<string, never>;
}

export interface MutationResult {
  success: boolean;
  /** Mutation to apply to undo this change */
  inverseMutation?: Mutation;
  /** Changes that were applied */
  changes: MutationChange[];
  /** Error message if failed */
  error?: string;
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Data returned by read-only operations (e.g., GET_DASHBOARD_INFO) */
  data?: unknown;
}

export interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationTransaction {
  id: string;
  mutations: Mutation[];
  status: 'pending' | 'committed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface MutationEvent {
  type: 'mutation_applied' | 'mutation_failed';
  mutation: Mutation;
  result: MutationResult;
  transaction?: MutationTransaction;
  timestamp: number;
  source: 'assistant' | 'ui' | 'api';
}

/**
 * Command schema definition for exposing commands to external consumers.
 */
export interface CommandSchemaDefinition {
  name: string;
  description: string;
  /** Implementation status */
  status: 'implemented' | 'stub' | 'planned';
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ResourceSchemaDefinition {
  uri: string;
  uriTemplate?: boolean;
  name: string;
  description: string;
  mimeType: string;
}

export interface PromptSchemaDefinition {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/** @deprecated Use CommandSchemaDefinition instead */
export type MCPToolDefinition = CommandSchemaDefinition;
/** @deprecated Use ResourceSchemaDefinition instead */
export type MCPResourceDefinition = ResourceSchemaDefinition;
/** @deprecated Use PromptSchemaDefinition instead */
export type MCPPromptDefinition = PromptSchemaDefinition;
