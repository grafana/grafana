export const HEALTH_MODELS_API_VERSION = '2026-09-01-preview';

export interface AzureHealthModelsOptions {
  healthModelId?: string;
}

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

export interface ArmListResponse<T> {
  value: T[];
  nextLink?: string;
}
