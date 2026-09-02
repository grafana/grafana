import { lastValueFrom } from 'rxjs';

import { type DataQueryRequest, type Field, MappingType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { AzureQueryType } from '../dataquery.gen';
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
              properties: {
                displayName: 'Entity One',
                healthState: 'Healthy',
                impact: 'Standard',
                signalGroups: {
                  azureResource: {
                    resourceHealth: {
                      status: {
                        healthState: 'Healthy',
                        availabilityState: 'Available',
                        reportedAt: '2026-01-01T00:00:00Z',
                      },
                    },
                  },
                  azureLogAnalytics: {
                    signals: [
                      { name: 'error-rate', status: { healthState: 'Degraded', reportedAt: '2026-01-01T01:00:00Z' } },
                    ],
                  },
                },
                alerts: { 'alert-one': { severity: 'Sev1' } },
              },
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
      queryType: AzureQueryType.AzureHealthModels,
      subscription: subscriptionId,
      azureHealthModels: { healthModelId },
    });

    const response = await lastValueFrom(
      datasource.query({
        targets: [query],
      } as DataQueryRequest<AzureMonitorQuery>)
    );

    expect(response.data.map((frame) => frame.name)).toEqual(['Entities', 'Health Model', 'Relationships']);
    expect(response.data.map((frame) => frame.length)).toEqual([1, 1, 1]);
    expect(response.data[0].meta?.preferredVisualisationType).toBe('table');
    expect(response.data[0].fields.map((field: Field) => field.name)).toEqual([
      'name',
      'displayName',
      'healthState',
      'healthStateValue',
      'signalsHealthy',
      'signalsTotal',
      'availabilityState',
      'alertSeverities',
      'impact',
      'healthObjective',
      'provisioningState',
    ]);
    // `name` is the key relationships reference, so it must be present, but it is hidden to keep
    // the default table readable.
    expect(response.data[0].fields[0].values).toEqual(['entity-one']);
    expect(response.data[0].fields[0].config).toEqual({ custom: { hidden: true } });
    expect(response.data[0].fields.find((field: Field) => field.name === 'healthState')?.config).toEqual({
      custom: {
        cellOptions: {
          type: TableCellDisplayMode.ColorText,
        },
      },
      mappings: [
        {
          type: MappingType.ValueToText,
          options: {
            Healthy: { text: 'Healthy', color: 'green' },
            Degraded: { text: 'Degraded', color: 'orange' },
            Unhealthy: { text: 'Unhealthy', color: 'red' },
            Unknown: { text: 'Unknown', color: 'gray' },
            Deleted: { text: 'Deleted', color: 'gray' },
          },
        },
      ],
    });
    // The health telemetry is nested inside `signalGroups` at inconsistent depths, so prove it is
    // actually extracted rather than just present as columns.
    const entityField = (name: string) => response.data[0].fields.find((field: Field) => field.name === name)?.values[0];
    expect(entityField('healthStateValue')).toBe(0); // Healthy
    // Enum text/colour must live under `config.type.enum`; panels such as Time series read it
    // with a non-null assertion, so the wrong shape crashes them rather than degrading.
    expect(
      response.data[0].fields.find((field: Field) => field.name === 'healthStateValue')?.config.type?.enum?.text
    ).toEqual(['Healthy', 'Degraded', 'Unhealthy', 'Unknown', 'Deleted']);
    expect(entityField('signalsTotal')).toBe(2);
    expect(entityField('signalsHealthy')).toBe(1);
    expect(entityField('availabilityState')).toBe('Available');
    expect(entityField('alertSeverities')).toBe('Sev1');
    expect(entityField('impact')).toBe('Standard');

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
      queryType: AzureQueryType.AzureHealthModels,
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
  it('returns node graph frames when the model graph format is selected', async () => {
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    jest.spyOn(datasource, 'getResource').mockImplementation(async (path: string) => {
      if (path.includes('/entities?')) {
        return {
          value: [
            { id: 'a', name: 'parent-entity', type: 't', properties: { displayName: 'Parent', healthState: 'Healthy' } },
            { id: 'b', name: 'child-entity', type: 't', properties: { displayName: 'Child', healthState: 'Degraded' } },
          ],
        };
      }
      if (path.includes('/relationships?')) {
        return {
          value: [
            {
              id: 'r1',
              name: 'rel-one',
              type: 't',
              properties: { parentEntityName: 'parent-entity', childEntityName: 'child-entity' },
            },
            // References an entity outside the model, so it must be dropped.
            {
              id: 'r2',
              name: 'rel-two',
              type: 't',
              properties: { parentEntityName: 'parent-entity', childEntityName: 'missing-entity' },
            },
          ],
        };
      }
      return { id: healthModelId, name: 'model-one', type: 't' };
    });

    const query = createMockQuery({
      queryType: AzureQueryType.AzureHealthModels,
      subscription: subscriptionId,
      azureHealthModels: { healthModelId, resultFormat: 'modelGraph' },
    });

    const response = await lastValueFrom(
      datasource.query({
        targets: [query],
      } as DataQueryRequest<AzureMonitorQuery>)
    );

    expect(response.data.map((frame) => frame.name)).toEqual(['nodes', 'edges']);
    expect(response.data[0].meta?.preferredVisualisationType).toBe('nodeGraph');
    const nodeField = (name: string) => response.data[0].fields.find((field: Field) => field.name === name)?.values;
    expect(nodeField('id')).toEqual(['parent-entity', 'child-entity']);
    expect(nodeField('title')).toEqual(['Parent', 'Child']);

    const edgeField = (name: string) => response.data[1].fields.find((field: Field) => field.name === name)?.values;
    expect(edgeField('source')).toEqual(['parent-entity']);
    expect(edgeField('target')).toEqual(['child-entity']);
  });

});
