import { DataSourceApi, PluginType, VariableSupportType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { buildNewDashboardSaveModel, buildNewDashboardSaveModelV2 } from './buildNewDashboardSaveModel';

const fakeDsMock: DataSourceApi = {
  name: 'fake-std',
  type: 'fake-std',
  getRef: () => ({ type: 'fake-std', uid: 'fake-std' }),
  query: () =>
    Promise.resolve({
      data: [],
    }),
  testDatasource: () => Promise.resolve({ status: 'success', message: 'abc' }),
  meta: {
    id: 'fake-std',
    type: PluginType.datasource,
    module: 'fake-std',
    baseUrl: '',
    name: 'fake-std',
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { large: '', small: '' },
      updated: '',
      version: '',
      screenshots: [],
    },
  },
  // Standard variable support
  variables: {
    getType: () => VariableSupportType.Standard,
    toDataQuery: (q) => ({ ...q, refId: 'FakeDataSource-refId' }),
  },
  getTagKeys: jest.fn(),
  id: 1,
  uid: 'fake-std',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      newDashboardWithFiltersAndGroupBy: false,
    },
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      user: {
        timezone: 'Africa/Abidjan',
      },
    },
  },
  getDataSourceSrv: () => ({
    get: (): Promise<DataSourceApi> => {
      return Promise.resolve(fakeDsMock);
    },
  }),
}));

describe('buildNewDashboardSaveModelV1', () => {
  it('should not have template variables defined by default', async () => {
    const result = await buildNewDashboardSaveModel();
    expect(result.dashboard.templating).toBeUndefined();
  });

  describe('when featureToggles.newDashboardWithFiltersAndGroupBy is true', () => {
    beforeAll(() => {
      config.featureToggles.newDashboardWithFiltersAndGroupBy = true;
    });
    afterAll(() => {
      config.featureToggles.newDashboardWithFiltersAndGroupBy = false;
    });

    it('should add filter and group by variables if the datasource supports it and is set as default', async () => {
      const result = await buildNewDashboardSaveModel();
      expect(result.dashboard.templating?.list).toHaveLength(2);
      expect(result.dashboard.templating?.list?.[0].type).toBe('adhoc');
      expect(result.dashboard.templating?.list?.[1].type).toBe('groupby');
    });

    it("should set the new dashboard's timezone to the user's timezone", async () => {
      const result = await buildNewDashboardSaveModel();
      expect(result.dashboard.timezone).toEqual('Africa/Abidjan');
    });
  });
});

describe('buildNewDashboardSaveModelV2', () => {
  it('should not have template variables defined by default', async () => {
    const result = await buildNewDashboardSaveModelV2();
    expect(result.spec.variables).toEqual([]);
  });

  describe('when featureToggles.newDashboardWithFiltersAndGroupBy is true', () => {
    beforeAll(() => {
      config.featureToggles.newDashboardWithFiltersAndGroupBy = true;
    });
    afterAll(() => {
      config.featureToggles.newDashboardWithFiltersAndGroupBy = false;
    });

    it('should add filter and group by variables if the datasource supports it and is set as default', async () => {
      const result = await buildNewDashboardSaveModelV2();
      expect(result.spec.variables).toHaveLength(2);
      expect(result.spec.variables[0].kind).toBe('AdhocVariable');
      expect(result.spec.variables[1].kind).toBe('GroupByVariable');
    });

    it("should set the new dashboard's timezone to the user's timezone", async () => {
      const result = await buildNewDashboardSaveModelV2();
      expect(result.spec.timeSettings.timezone).toEqual('Africa/Abidjan');
    });
  });
});
