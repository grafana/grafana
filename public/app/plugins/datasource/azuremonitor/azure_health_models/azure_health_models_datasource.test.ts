import { createMockInstanceSetttings } from '../mocks/instanceSettings';

import AzureHealthModelsDatasource from './azure_health_models_datasource';

let replace = (value?: string) => value || '';

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace,
      getVariables: jest.fn(),
      updateTimeRange: jest.fn(),
      containsTemplate: jest.fn(),
    }),
  };
});

describe('AzureHealthModelsDatasource', () => {
  beforeEach(() => {
    replace = (value?: string) => value || '';
  });

  it('returns an empty list when the subscription cannot be resolved', async () => {
    replace = () => '';
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    datasource.getResource = jest.fn();

    const healthModels = await datasource.getHealthModels('$subscription');

    expect(healthModels).toEqual([]);
    expect(datasource.getResource).not.toHaveBeenCalled();
  });

  it('queries CloudHealth healthmodels and maps results', async () => {
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    datasource.getResource = jest.fn().mockResolvedValue({
      value: [
        { id: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1', name: 'Health Model 1' },
        { id: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2', name: 'Health Model 2' },
      ],
    });

    const healthModels = await datasource.getHealthModels('sub-a');

    expect(datasource.getResource).toHaveBeenCalledWith(
      'azuremonitor/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels?api-version=2026-11-01'
    );
    expect(healthModels).toEqual([
      {
        text: 'Health Model 1',
        value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-1',
      },
      {
        text: 'Health Model 2',
        value: '/subscriptions/sub-a/providers/Microsoft.CloudHealth/healthmodels/hm-2',
      },
    ]);
  });

  it('uses the template-resolved subscription value in the ARM request path', async () => {
    replace = (value?: string) => (value === '$sub' ? 'resolved-subscription' : value || '');
    const datasource = new AzureHealthModelsDatasource(createMockInstanceSetttings());
    datasource.getResource = jest.fn().mockResolvedValue({ value: [] });

    await datasource.getHealthModels('$sub');

    expect(datasource.getResource).toHaveBeenCalledWith(
      'azuremonitor/subscriptions/resolved-subscription/providers/Microsoft.CloudHealth/healthmodels?api-version=2026-11-01'
    );
  });
});
