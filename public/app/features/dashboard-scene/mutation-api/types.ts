/**
 * Dashboard Mutation API - Core Types
 *
 * Shared framework types used across the mutation system.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 *
 * These types are internal to grafana core. Plugin consumers get minimal
 * interfaces via RestrictedGrafanaApis in @grafana/data.
 */

export interface MutationRequest {
  type: string;
  payload: unknown;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  changes: MutationChange[];
  warnings?: string[];
  data?: unknown;
}

export interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationClient {
  execute(mutation: MutationRequest): Promise<MutationResult>;
}

export interface ListVariablesData {
  variables: Array<{ kind: string; spec: { name: string; [key: string]: unknown } }>;
}
