import { type AzureQueryType } from '../dataquery.gen';
import { type AzureMonitorQuery } from '../types/query';

export const AZURE_HEALTH_MODELS_SERVICE = 'Azure Health Models' as const;

export type AzureMonitorService = AzureQueryType | typeof AZURE_HEALTH_MODELS_SERVICE;

export function getAzureMonitorService(query: AzureMonitorQuery): AzureMonitorService | undefined {
  if (query.queryType) {
    return query.queryType;
  }

  return query.azureHealthModels ? AZURE_HEALTH_MODELS_SERVICE : undefined;
}

export function setAzureMonitorService(query: AzureMonitorQuery, service: AzureMonitorService): AzureMonitorQuery {
  if (service === AZURE_HEALTH_MODELS_SERVICE) {
    return {
      ...query,
      queryType: undefined,
      azureHealthModels: query.azureHealthModels ?? {},
    };
  }

  return {
    ...query,
    queryType: service,
  };
}
