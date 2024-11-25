import { AdHocFiltersVariable } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { limitAdhocProviders } from './utils';

describe('limitAdhocProviders', () => {
  let filtersVariable: AdHocFiltersVariable;
  let datasourceHelper: MetricDatasourceHelper;
  let dataTrail: DataTrail;

  beforeEach(() => {
    // disable console.log called in Scenes for this test
    // called in scenes/packages/scenes/src/variables/adhoc/patchGetAdhocFilters.ts
    jest.spyOn(console, 'log').mockImplementation(jest.fn());

    filtersVariable = new AdHocFiltersVariable({
      name: 'testVariable',
      label: 'Test Variable',
      type: 'adhoc',
    });

    datasourceHelper = {
      getTagKeys: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'key' })),
      getTagValues: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'value' })),
    } as unknown as MetricDatasourceHelper;

    dataTrail = {
      getQueries: jest.fn().mockReturnValue([]),
    } as unknown as DataTrail;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should limit the number of tag keys returned in the variable to 10000', async () => {
    limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

    if (filtersVariable instanceof AdHocFiltersVariable && filtersVariable.state.getTagKeysProvider) {
      console.log = jest.fn();

      const result = await filtersVariable.state.getTagKeysProvider(filtersVariable, null);
      expect(result.values).toHaveLength(10000);
      expect(result.replace).toBe(true);
    }
  });

  it('should limit the number of tag values returned in the variable to 10000', async () => {
    limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

    if (filtersVariable instanceof AdHocFiltersVariable && filtersVariable.state.getTagValuesProvider) {
      const result = await filtersVariable.state.getTagValuesProvider(filtersVariable, {
        key: 'testKey',
        operator: '=',
        value: 'testValue',
      });
      expect(result.values).toHaveLength(10000);
      expect(result.replace).toBe(true);
    }
  });
});
