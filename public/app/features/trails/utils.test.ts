import { AdHocFiltersVariable, SceneObjectRef } from '@grafana/scenes';

import { getDatasourceSrv } from '../plugins/datasource_srv';

import { DataTrail } from './DataTrail';
import { getTrailStore } from './TrailStore/TrailStore';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { getDatasourceForNewTrail, limitAdhocProviders } from './utils';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
}));

jest.mock('../plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(),
}));

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

describe('getDatasourceForNewTrail', () => {
  beforeEach(() => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
    }));
    (getDatasourceSrv as jest.Mock).mockImplementation(() => ({
      getList: jest.fn().mockReturnValue([
        { uid: 'prom1', isDefault: true },
        { uid: 'prom2', isDefault: false },
      ]),
    }));
  });

  it('should return the most recent exploration data source', () => {
    const trail = new DataTrail({ key: '1', metric: 'select me', initialDS: 'prom2' });
    const trailWithResolveMethod = new SceneObjectRef(trail);
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [trailWithResolveMethod],
    }));
    const result = getDatasourceForNewTrail();
    expect(result).toBe('prom2');
  });

  it('should return the default Prometheus data source if no previous exploration exists', () => {
    const result = getDatasourceForNewTrail();
    expect(result).toBe('prom1');
  });

  it('should return the most recently added Prom data source if no default exists and no recent exploration', () => {
    (getDatasourceSrv as jest.Mock).mockImplementation(() => ({
      getList: jest.fn().mockReturnValue([
        { uid: 'newProm', isDefault: false },
        { uid: 'prom1', isDefault: false },
        { uid: 'prom2', isDefault: false },
      ]),
    }));
    const result = getDatasourceForNewTrail();
    expect(result).toBe('newProm');
  });
});
