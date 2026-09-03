export const HEALTH_MODELS_API_VERSION = '2026-09-01-preview';

export interface AzureHealthModelsOptions {
  healthModelId?: string;
  /**
   * Which view of the model to return. Defaults to `entities` so an existing query keeps its
   * current behaviour.
   */
  resultFormat?: HealthModelsResultFormat;
}

export type HealthModelsResultFormat = 'entities' | 'modelGraph' | 'timeSeries';

export interface HealthModelResourceId {
  subscriptionId: string;
  resourceGroupName: string;
  healthModelName: string;
}

export interface HealthModel {
  id: string;
  name: string;
  type: string;
  location?: string;
  tags?: Record<string, string>;
  properties?: {
    provisioningState?: string;
  };
}

export interface HealthModelEntity {
  id: string;
  name: string;
  type: string;
  properties?: {
    displayName?: string;
    healthState?: string;
    impact?: string;
    provisioningState?: string;
    healthObjective?: number | null;
    tags?: Record<string, string>;
    /**
     * Signal configuration and last reported status, grouped by signal kind. The shape varies by
     * kind and nests status objects at different depths, so it is read defensively rather than
     * typed exhaustively.
     */
    signalGroups?: Record<string, unknown>;
    alerts?: Record<string, { severity?: string } | undefined>;
  };
}

export interface HealthModelRelationship {
  id: string;
  name: string;
  type: string;
  properties?: {
    displayName?: string;
    parentEntityName?: string;
    childEntityName?: string;
    provisioningState?: string;
    tags?: Record<string, string>;
  };
}

export interface HealthModelEntityHistoryTransition {
  previousState: string;
  newState: string;
  occurredAt: string;
  reason?: string;
}

export interface HealthModelEntityHistoryResponse {
  entityName: string;
  history: HealthModelEntityHistoryTransition[];
  nextMarker?: string;
}

export interface ArmListResponse<T> {
  value: T[];
  nextLink?: string;
}
