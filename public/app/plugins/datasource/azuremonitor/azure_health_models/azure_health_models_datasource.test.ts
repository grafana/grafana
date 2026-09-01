import { lastValueFrom } from 'rxjs';

import { type DataQueryRequest } from '@grafana/data';

import { createMockInstanceSetttings } from '../mocks/instanceSettings';
import createMockQuery from '../mocks/query';
import { type AzureMonitorQuery } from '../types/query';

import AzureHealthModelsDatasource, { parseHealthModelResourceId } from './azure_health_models_datasource';
import { HEALTH_MODELS_API_VERSION } from './types';

const subscriptionId = '11111111-1111-1111-1111-111111111111';
const healthModelId = `/subscriptions/${subscriptionId}/resourceGroups/rg-one/providers/Microsoft.CloudHealth/healthmodels/model-one`;

describe('AzureHealthModelsDatasource', () => {
  it('loads Health Models directly from the Microsoft.CloudHealth ARM API', async () => {
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    const getResource = jest.spyOn(datasource, 'getResource').mockResolvedValue({
      value: [
        {
          id: healthModelId,
          name: 'model-one',
          type: 'Microsoft.CloudHealth/healthmodels',
        },
      ],
    });

    const models = await datasource.getHealthModels(subscriptionId);

    expect(models).toHaveLength(1);
    expect(getResource).toHaveBeenCalledWith(
      `azuremonitor/subscriptions/${subscriptionId}/providers/Microsoft.CloudHealth/healthmodels?api-version=${HEALTH_MODELS_API_VERSION}`
    );
  });

  it('returns model, entity, and relationship frames without using an Azure Monitor query API', async () => {
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    const getResource = jest.spyOn(datasource, 'getResource').mockImplementation(async (path) => {
      if (path === `azuremonitor${healthModelId}`) {
        return {
          id: healthModelId,
          name: 'model-one',
          type: 'Microsoft.CloudHealth/healthmodels',
          location: 'centralus',
          properties: { provisioningState: 'Succeeded' },
        };
      }
      if (path.includes('/entities?')) {
        return {
          value: [
            {
              id: `${healthModelId}/entities/entity-one`,
              name: 'entity-one',
              type: 'Microsoft.CloudHealth/healthmodels/entities',
              properties: { displayName: 'Entity One', healthState: 'Healthy' },
            },
          ],
        };
      }
      if (path.includes('/relationships?')) {
        return {
          value: [
            {
              id: `${healthModelId}/relationships/relationship-one`,
              name: 'relationship-one',
              type: 'Microsoft.CloudHealth/healthmodels/relationships',
              properties: { parentEntityName: 'entity-one', childEntityName: 'entity-two' },
            },
          ],
        };
      }
      throw new Error(`Unexpected resource path: ${path}`);
    });
    const query = createMockQuery({
      queryType: undefined,
      subscription: subscriptionId,
      azureHealthModels: { healthModelId },
    });

    const response = await lastValueFrom(
      datasource.query({
        targets: [query],
      } as DataQueryRequest<AzureMonitorQuery>)
    );

    expect(response.data.map((frame) => frame.name)).toEqual(['Health Model', 'Entities', 'Relationships']);
    expect(response.data.map((frame) => frame.length)).toEqual([1, 1, 1]);
    expect(getResource).toHaveBeenCalledWith(`azuremonitor${healthModelId}`, {
      'api-version': HEALTH_MODELS_API_VERSION,
    });
    expect(getResource).toHaveBeenCalledWith(
      `azuremonitor${healthModelId}/entities?api-version=${HEALTH_MODELS_API_VERSION}`
    );
    expect(getResource).toHaveBeenCalledWith(
      `azuremonitor${healthModelId}/relationships?api-version=${HEALTH_MODELS_API_VERSION}`
    );
  });

  it('rejects a Health Model resource ID from another subscription', async () => {
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    const query = createMockQuery({
      queryType: undefined,
      subscription: '22222222-2222-2222-2222-222222222222',
      azureHealthModels: { healthModelId },
    });

    await expect(
      lastValueFrom(
        datasource.query({
          targets: [query],
        } as DataQueryRequest<AzureMonitorQuery>)
      )
    ).rejects.toThrow('does not belong to the selected subscription');
  });

  it('parses a Microsoft.CloudHealth Health Model resource ID', () => {
    expect(parseHealthModelResourceId(healthModelId)).toEqual({
      subscriptionId,
      resourceGroupName: 'rg-one',
      healthModelName: 'model-one',
    });
  });

  it('rejects encoded path separators in a Health Model resource ID', () => {
    expect(() =>
      parseHealthModelResourceId(
        `/subscriptions/${subscriptionId}/resourceGroups/rg%2Fother/providers/Microsoft.CloudHealth/healthmodels/model-one`
      )
    ).toThrow('not a valid Microsoft.CloudHealth Health Model resource ID');
  });
});
