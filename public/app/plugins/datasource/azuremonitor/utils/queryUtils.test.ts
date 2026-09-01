import { AzureQueryType } from '../dataquery.gen';
import { type AzureMonitorQuery } from '../types/query';

import { AZURE_HEALTH_MODELS_SERVICE, getAzureMonitorService, setAzureMonitorService } from './queryUtils';

describe('queryUtils', () => {
  it('represents Azure Health Models as a service without assigning a query type', () => {
    const query = setAzureMonitorService(
      { refId: 'A', queryType: AzureQueryType.AzureMonitor },
      AZURE_HEALTH_MODELS_SERVICE
    );

    expect(query).toEqual({
      refId: 'A',
      queryType: undefined,
      azureHealthModels: {},
    });
    expect(getAzureMonitorService(query)).toBe(AZURE_HEALTH_MODELS_SERVICE);
  });

  it('uses the query type as the service for existing Azure Monitor queries', () => {
    const query: AzureMonitorQuery = {
      refId: 'A',
      queryType: AzureQueryType.AzureResourceGraph,
    };

    expect(getAzureMonitorService(query)).toBe(AzureQueryType.AzureResourceGraph);
  });
});
