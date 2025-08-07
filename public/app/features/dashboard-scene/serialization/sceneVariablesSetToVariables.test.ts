import { of } from 'rxjs';

import {
  DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PluginType,
  ScopedVars,
  toDataFrame,
  VariableSupportType,
} from '@grafana/data';
import { config, setRunRequest } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneVariableSet,
  TextBoxVariable,
} from '@grafana/scenes';
import { DataSourceRef, VariableRefresh } from '@grafana/schema';

import { sceneVariablesSetToSchemaV2Variables, sceneVariablesSetToVariables } from './sceneVariablesSetToVariables';

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

setRunRequest(runRequestMock);

const getDataSourceMock = jest.fn();

const fakeDsMock: DataSourceApi = {
  name: 'fake-std',
  type: 'fake-type',
  getRef: () => ({ type: 'fake-type', uid: 'fake-uid' }),
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
  id: 1,
  uid: 'fake-uid',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: (ds: DataSourceRef, vars: ScopedVars): Promise<DataSourceApi> => {
      getDataSourceMock(ds, vars);
      return Promise.resolve(fakeDsMock);
    },
  }),
}));

describe('sceneVariablesSetToVariables', () => {
  it('should handle QueryVariable', () => {
    const variable = new QueryVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['selected-value'],
      text: ['selected-value-text'],
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      query: 'query',
      includeAll: true,
      allowCustomValue: true,
      allValue: 'test-all',
      isMulti: true,
      staticOptions: [{ label: 'test', value: 'test' }],
      staticOptionsOrder: 'after',
    });

    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allValue": "test-all",
      "allowCustomValue": true,
      "current": {
        "text": [
          "selected-value-text",
        ],
        "value": [
          "selected-value",
        ],
      },
      "datasource": {
        "type": "fake-type",
        "uid": "fake-uid",
      },
      "definition": undefined,
      "description": "test-desc",
      "includeAll": true,
      "label": "test-label",
      "multi": true,
      "name": "test",
      "options": [],
      "query": "query",
      "refresh": 1,
      "regex": "",
      "staticOptions": [
        {
          "text": "test",
          "value": "test",
        },
      ],
      "staticOptionsOrder": "after",
      "type": "query",
    }
    `);
  });

  it('should handle QueryVariable with definition set', () => {
    const variable = new QueryVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['selected-value'],
      text: ['selected-value-text'],
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      query: 'query',
      definition: 'query',
      includeAll: true,
      allValue: 'test-all',
      allowCustomValue: false,
      isMulti: true,
      staticOptions: [{ label: 'test', value: 'test' }],
      staticOptionsOrder: 'after',
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allValue": "test-all",
      "allowCustomValue": false,
      "current": {
        "text": [
          "selected-value-text",
        ],
        "value": [
          "selected-value",
        ],
      },
      "datasource": {
        "type": "fake-type",
        "uid": "fake-uid",
      },
      "definition": "query",
      "description": "test-desc",
      "includeAll": true,
      "label": "test-label",
      "multi": true,
      "name": "test",
      "options": [],
      "query": "query",
      "refresh": 1,
      "regex": "",
      "staticOptions": [
        {
          "text": "test",
          "value": "test",
        },
      ],
      "staticOptionsOrder": "after",
      "type": "query",
    }
    `);
  });

  it('should handle Query variable when sceneVariablesSetToVariables should discard options', () => {
    const variable = new QueryVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['selected-value'],
      text: ['selected-value-text'],
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      query: 'query',
      options: [
        { label: 'test', value: 'test' },
        { label: 'test1', value: 'test1' },
        { label: 'test2', value: 'test2' },
      ],
      includeAll: true,
      allValue: 'test-all',
      isMulti: true,
    });

    const set = new SceneVariableSet({
      variables: [variable],
    });
    const result = sceneVariablesSetToVariables(set);
    expect(result).toHaveLength(1);
    expect(result[0].options).toEqual([]);
  });

  it('should handle Query variable when sceneVariablesSetToVariables should keep options', () => {
    const variable = new QueryVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['test'],
      text: ['test'],
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      query: 'query',
      options: [
        { label: 'test', value: 'test' },
        { label: 'test1', value: 'test1' },
        { label: 'test2', value: 'test2' },
      ],
      includeAll: true,
      allValue: 'test-all',
      isMulti: true,
    });

    const set = new SceneVariableSet({
      variables: [variable],
    });
    const keepQueryOptions = true;
    const result = sceneVariablesSetToVariables(set, keepQueryOptions);
    expect(result).toHaveLength(1);
    expect(result[0].options).not.toEqual([]);
    expect(result[0].options?.length).toEqual(3);
  });

  it('should handle DatasourceVariable', () => {
    const variable = new DataSourceVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['selected-ds-1', 'selected-ds-2'],
      text: ['selected-ds-1-text', 'selected-ds-2-text'],
      pluginId: 'fake-std',
      includeAll: true,
      allValue: 'test-all',
      allowCustomValue: true,
      isMulti: true,
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allValue": "test-all",
      "allowCustomValue": true,
      "current": {
        "text": [
          "selected-ds-1-text",
          "selected-ds-2-text",
        ],
        "value": [
          "selected-ds-1",
          "selected-ds-2",
        ],
      },
      "description": "test-desc",
      "includeAll": true,
      "label": "test-label",
      "multi": true,
      "name": "test",
      "options": [],
      "query": "fake-std",
      "refresh": 1,
      "regex": "",
      "type": "datasource",
    }
    `);
  });

  it('should handle CustomVariable', () => {
    const variable = new CustomVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: ['test', 'test2'],
      text: ['test', 'test2'],
      query: 'test,test1,test2',
      options: [
        { label: 'test', value: 'test' },
        { label: 'test1', value: 'test1' },
        { label: 'test2', value: 'test2' },
      ],
      includeAll: true,
      allValue: 'test-all',
      allowCustomValue: true,
      isMulti: true,
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allValue": "test-all",
      "allowCustomValue": true,
      "current": {
        "text": [
          "test",
          "test2",
        ],
        "value": [
          "test",
          "test2",
        ],
      },
      "description": "test-desc",
      "includeAll": true,
      "label": "test-label",
      "multi": true,
      "name": "test",
      "options": [
        {
          "selected": true,
          "text": "test",
          "value": "test",
        },
        {
          "selected": false,
          "text": "test1",
          "value": "test1",
        },
        {
          "selected": true,
          "text": "test2",
          "value": "test2",
        },
      ],
      "query": "test,test1,test2",
      "type": "custom",
    }
    `);
  });

  it('should handle ConstantVariable', () => {
    const variable = new ConstantVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: 'constant value',
      skipUrlSync: true,
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "current": {
        "text": "constant value",
        "value": "constant value",
      },
      "description": "test-desc",
      "hide": 2,
      "label": "test-label",
      "name": "test",
      "query": "constant value",
      "skipUrlSync": true,
      "type": "constant",
    }
    `);
  });

  it('should handle TextBoxVariable', () => {
    const variable = new TextBoxVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      value: 'text value',
      skipUrlSync: true,
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "current": {
        "text": "text value",
        "value": "text value",
      },
      "description": "test-desc",
      "label": "test-label",
      "name": "test",
      "options": [
        {
          "selected": true,
          "text": "text value",
          "value": "text value",
        },
      ],
      "query": "text value",
      "skipUrlSync": true,
      "type": "textbox",
    }
    `);
  });

  it('should handle IntervalVariable', () => {
    const variable = new IntervalVariable({
      intervals: ['1m', '2m', '3m', '1h', '1d'],
      value: '1m',
      refresh: VariableRefresh.onDashboardLoad,
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result[0]).toMatchInlineSnapshot(`
    {
      "auto": false,
      "auto_count": 30,
      "auto_min": "10s",
      "current": {
        "text": "1m",
        "value": "1m",
      },
      "description": undefined,
      "label": undefined,
      "name": "",
      "options": [
        {
          "selected": true,
          "text": "1m",
          "value": "1m",
        },
        {
          "selected": false,
          "text": "2m",
          "value": "2m",
        },
        {
          "selected": false,
          "text": "3m",
          "value": "3m",
        },
        {
          "selected": false,
          "text": "1h",
          "value": "1h",
        },
        {
          "selected": false,
          "text": "1d",
          "value": "1d",
        },
      ],
      "query": "1m,2m,3m,1h,1d",
      "refresh": 1,
      "type": "interval",
    }
    `);
  });

  it('should handle AdHocFiltersVariable', () => {
    const variable = new AdHocFiltersVariable({
      name: 'test',
      allowCustomValue: true,
      label: 'test-label',
      description: 'test-desc',
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      filters: [
        {
          key: 'filterTest',
          operator: '=',
          value: 'test',
        },
      ],
      baseFilters: [
        {
          key: 'baseFilterTest',
          operator: '=',
          value: 'test',
        },
      ],
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allowCustomValue": true,
      "baseFilters": [
        {
          "key": "baseFilterTest",
          "operator": "=",
          "value": "test",
        },
      ],
      "datasource": {
        "type": "fake-type",
        "uid": "fake-uid",
      },
      "defaultKeys": undefined,
      "description": "test-desc",
      "filters": [
        {
          "key": "filterTest",
          "operator": "=",
          "value": "test",
        },
      ],
      "label": "test-label",
      "name": "test",
      "type": "adhoc",
    }
    `);
  });

  describe('should adapt AdHocFiltersVariable filters', () => {
    it('should remove non dashboard originated filters from schema', () => {
      const variable = new AdHocFiltersVariable({
        name: 'test',
        allowCustomValue: true,
        label: 'test-label',
        description: 'test-desc',
        datasource: { uid: 'fake-std', type: 'fake-std' },
        originFilters: [
          {
            key: 'filterTest',
            operator: '=',
            value: 'test',
            origin: 'asserts',
          },
        ],
        filters: [],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToVariables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
      {
        "allowCustomValue": true,
        "baseFilters": [],
        "datasource": {
          "type": "fake-std",
          "uid": "fake-std",
        },
        "defaultKeys": undefined,
        "description": "test-desc",
        "filters": [],
        "label": "test-label",
        "name": "test",
        "type": "adhoc",
      }
      `);
    });

    it('should not save origin filters in model', () => {
      const variable = new AdHocFiltersVariable({
        name: 'test',
        allowCustomValue: true,
        label: 'test-label',
        description: 'test-desc',
        datasource: { uid: 'fake-std', type: 'fake-std' },
        originFilters: [
          {
            key: 'filterTest',
            operator: '=',
            value: 'test',
            origin: 'dashboard',
          },
        ],
        filters: [
          {
            key: 'filterTest2',
            operator: '=',
            value: 'test2',
          },
        ],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToVariables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
      {
        "allowCustomValue": true,
        "baseFilters": [],
        "datasource": {
          "type": "fake-std",
          "uid": "fake-std",
        },
        "defaultKeys": undefined,
        "description": "test-desc",
        "filters": [
          {
            "key": "filterTest",
            "operator": "=",
            "origin": "dashboard",
            "value": "test",
          },
          {
            "key": "filterTest2",
            "operator": "=",
            "value": "test2",
          },
        ],
        "label": "test-label",
        "name": "test",
        "type": "adhoc",
      }
      `);
    });
  });

  it('should handle AdHocFiltersVariable with defaultKeys', () => {
    const variable = new AdHocFiltersVariable({
      name: 'test',
      allowCustomValue: true,
      label: 'test-label',
      description: 'test-desc',
      datasource: { uid: 'fake-uid', type: 'fake-type' },
      defaultKeys: [
        {
          text: 'some',
          value: '1',
        },
        {
          text: 'static',
          value: '2',
        },
        {
          text: 'keys',
          value: '3',
        },
      ],
      filters: [
        {
          key: 'filterTest',
          operator: '=',
          value: 'test',
        },
      ],
      baseFilters: [
        {
          key: 'baseFilterTest',
          operator: '=',
          value: 'test',
        },
      ],
    });
    const set = new SceneVariableSet({
      variables: [variable],
    });

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allowCustomValue": true,
      "baseFilters": [
        {
          "key": "baseFilterTest",
          "operator": "=",
          "value": "test",
        },
      ],
      "datasource": {
        "type": "fake-type",
        "uid": "fake-uid",
      },
      "defaultKeys": [
        {
          "text": "some",
          "value": "1",
        },
        {
          "text": "static",
          "value": "2",
        },
        {
          "text": "keys",
          "value": "3",
        },
      ],
      "description": "test-desc",
      "filters": [
        {
          "key": "filterTest",
          "operator": "=",
          "value": "test",
        },
      ],
      "label": "test-label",
      "name": "test",
      "type": "adhoc",
    }
    `);
  });

  describe('when the groupByVariable feature toggle is enabled', () => {
    beforeAll(() => {
      config.featureToggles.groupByVariable = true;
    });

    afterAll(() => {
      config.featureToggles.groupByVariable = false;
    });

    it('should handle GroupByVariable', () => {
      const variable = new GroupByVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        allowCustomValue: true,
        datasource: { uid: 'fake-uid', type: 'fake-type' },
        defaultOptions: [
          {
            text: 'Foo',
            value: 'foo',
          },
          {
            text: 'Bar',
            value: 'bar',
          },
        ],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToVariables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
      {
        "allowCustomValue": true,
        "current": {
          "text": [],
          "value": [],
        },
        "datasource": {
          "type": "fake-type",
          "uid": "fake-uid",
        },
        "defaultValue": undefined,
        "description": "test-desc",
        "label": "test-label",
        "name": "test",
        "options": [
          {
            "text": "Foo",
            "value": "foo",
          },
          {
            "text": "Bar",
            "value": "bar",
          },
        ],
        "type": "groupby",
      }
      `);
    });
  });

  describe('when the groupByVariable feature toggle is disabled', () => {
    it('should not handle GroupByVariable and throw an error', () => {
      const variable = new GroupByVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        datasource: { uid: 'fake-uid', type: 'fake-type' },
        defaultOptions: [
          {
            text: 'Foo',
            value: 'foo',
          },
          {
            text: 'Bar',
            value: 'bar',
          },
        ],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      expect(() => sceneVariablesSetToVariables(set)).toThrow('Unsupported variable type');
    });
  });

  describe('sceneVariablesSetToSchemaV2Variables', () => {
    it('should handle QueryVariable', () => {
      const variable = new QueryVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        value: ['selected-value'],
        text: ['selected-value-text'],
        datasource: { uid: 'fake-uid', type: 'fake-type' },
        query: 'query',
        includeAll: true,
        allValue: 'test-all',
        isMulti: true,
        staticOptions: [{ label: 'test', value: 'test' }],
        staticOptionsOrder: 'after',
      });

      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
        {
          "kind": "QueryVariable",
          "spec": {
            "allValue": "test-all",
            "allowCustomValue": true,
            "current": {
              "text": [
                "selected-value-text",
              ],
              "value": [
                "selected-value",
              ],
            },
            "definition": undefined,
            "description": "test-desc",
            "hide": "dontHide",
            "includeAll": true,
            "label": "test-label",
            "multi": true,
            "name": "test",
            "options": [],
            "query": {
              "datasource": {
                "name": "fake-uid",
              },
              "group": "fake-type",
              "kind": "DataQuery",
              "spec": {
                "__legacyStringValue": "query",
              },
              "version": "v0",
            },
            "refresh": "onDashboardLoad",
            "regex": "",
            "skipUrlSync": false,
            "sort": "disabled",
            "staticOptions": [
              {
                "text": "test",
                "value": "test",
              },
            ],
            "staticOptionsOrder": "after",
          },
        }
      `);
    });

    it('should handle CustomVariable', () => {
      const variable = new CustomVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        value: ['test', 'test2'],
        text: ['test', 'test2'],
        query: 'test,test1,test2',
        options: [
          { label: 'test', value: 'test' },
          { label: 'test1', value: 'test1' },
          { label: 'test2', value: 'test2' },
        ],
        includeAll: true,
        allValue: 'test-all',
        isMulti: true,
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "kind": "CustomVariable",
      "spec": {
        "allValue": "test-all",
        "allowCustomValue": true,
        "current": {
          "text": [
            "test",
            "test2",
          ],
          "value": [
            "test",
            "test2",
          ],
        },
        "description": "test-desc",
        "hide": "dontHide",
        "includeAll": true,
        "label": "test-label",
        "multi": true,
        "name": "test",
        "options": [
          {
            "selected": true,
            "text": "test",
            "value": "test",
          },
          {
            "selected": false,
            "text": "test1",
            "value": "test1",
          },
          {
            "selected": true,
            "text": "test2",
            "value": "test2",
          },
        ],
        "query": "test,test1,test2",
        "skipUrlSync": false,
      },
    }
    `);
    });

    it('should handle DatasourceVariable', () => {
      const variable = new DataSourceVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        value: ['selected-ds-1', 'selected-ds-2'],
        text: ['selected-ds-1-text', 'selected-ds-2-text'],
        pluginId: 'fake-std',
        includeAll: true,
        allValue: 'test-all',
        isMulti: true,
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "kind": "DatasourceVariable",
      "spec": {
        "allValue": "test-all",
        "allowCustomValue": true,
        "current": {
          "text": [
            "selected-ds-1-text",
            "selected-ds-2-text",
          ],
          "value": [
            "selected-ds-1",
            "selected-ds-2",
          ],
        },
        "description": "test-desc",
        "hide": "dontHide",
        "includeAll": true,
        "label": "test-label",
        "multi": true,
        "name": "test",
        "options": [],
        "pluginId": "fake-std",
        "refresh": "onDashboardLoad",
        "regex": "",
        "skipUrlSync": false,
      },
    }
    `);
    });

    it('should handle ConstantVariable', () => {
      const variable = new ConstantVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        value: 'constant value',
        skipUrlSync: true,
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "kind": "ConstantVariable",
      "spec": {
        "current": {
          "text": "constant value",
          "value": "constant value",
        },
        "description": "test-desc",
        "hide": "dontHide",
        "label": "test-label",
        "name": "test",
        "query": "constant value",
        "skipUrlSync": true,
      },
    }
    `);
    });

    it('should handle TextBoxVariable', () => {
      const variable = new TextBoxVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        value: 'text value',
        skipUrlSync: true,
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "kind": "TextVariable",
      "spec": {
        "current": {
          "text": "text value",
          "value": "text value",
        },
        "description": "test-desc",
        "hide": "dontHide",
        "label": "test-label",
        "name": "test",
        "query": "text value",
        "skipUrlSync": true,
      },
    }
    `);
    });

    it('should handle IntervalVariable', () => {
      const variable = new IntervalVariable({
        intervals: ['1m', '2m', '3m', '1h', '1d'],
        value: '1m',
        refresh: VariableRefresh.onDashboardLoad,
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result[0]).toMatchInlineSnapshot(`
    {
      "kind": "IntervalVariable",
      "spec": {
        "auto": false,
        "auto_count": 30,
        "auto_min": "10s",
        "current": {
          "text": "1m",
          "value": "1m",
        },
        "description": undefined,
        "hide": "dontHide",
        "label": undefined,
        "name": "",
        "options": [
          {
            "selected": true,
            "text": "1m",
            "value": "1m",
          },
          {
            "selected": false,
            "text": "2m",
            "value": "2m",
          },
          {
            "selected": false,
            "text": "3m",
            "value": "3m",
          },
          {
            "selected": false,
            "text": "1h",
            "value": "1h",
          },
          {
            "selected": false,
            "text": "1d",
            "value": "1d",
          },
        ],
        "query": "1m,2m,3m,1h,1d",
        "refresh": "onTimeRangeChanged",
        "skipUrlSync": false,
      },
    }
    `);
    });

    it('should handle AdHocFiltersVariable', () => {
      const variable = new AdHocFiltersVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        datasource: { uid: 'fake-uid', type: 'fake-type' },
        filters: [
          {
            key: 'filterTest',
            operator: '=',
            value: 'test',
          },
        ],
        baseFilters: [
          {
            key: 'baseFilterTest',
            operator: '=',
            value: 'test',
          },
        ],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "datasource": {
        "name": "fake-uid",
      },
      "group": "fake-type",
      "kind": "AdhocVariable",
      "spec": {
        "allowCustomValue": true,
        "baseFilters": [
          {
            "key": "baseFilterTest",
            "operator": "=",
            "value": "test",
          },
        ],
        "defaultKeys": [],
        "description": "test-desc",
        "filters": [
          {
            "key": "filterTest",
            "operator": "=",
            "value": "test",
          },
        ],
        "hide": "dontHide",
        "label": "test-label",
        "name": "test",
        "skipUrlSync": false,
      },
    }
    `);
    });

    it('should handle AdHocFiltersVariable with defaultKeys', () => {
      const variable = new AdHocFiltersVariable({
        name: 'test',
        label: 'test-label',
        description: 'test-desc',
        datasource: { uid: 'fake-uid', type: 'fake-type' },
        defaultKeys: [
          {
            text: 'some',
            value: '1',
          },
          {
            text: 'static',
            value: '2',
          },
          {
            text: 'keys',
            value: '3',
          },
        ],
        filters: [
          {
            key: 'filterTest',
            operator: '=',
            value: 'test',
          },
        ],
        baseFilters: [
          {
            key: 'baseFilterTest',
            operator: '=',
            value: 'test',
          },
        ],
      });
      const set = new SceneVariableSet({
        variables: [variable],
      });

      const result = sceneVariablesSetToSchemaV2Variables(set);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchInlineSnapshot(`
    {
      "datasource": {
        "name": "fake-uid",
      },
      "group": "fake-type",
      "kind": "AdhocVariable",
      "spec": {
        "allowCustomValue": true,
        "baseFilters": [
          {
            "key": "baseFilterTest",
            "operator": "=",
            "value": "test",
          },
        ],
        "defaultKeys": [
          {
            "text": "some",
            "value": "1",
          },
          {
            "text": "static",
            "value": "2",
          },
          {
            "text": "keys",
            "value": "3",
          },
        ],
        "description": "test-desc",
        "filters": [
          {
            "key": "filterTest",
            "operator": "=",
            "value": "test",
          },
        ],
        "hide": "dontHide",
        "label": "test-label",
        "name": "test",
        "skipUrlSync": false,
      },
    }
    `);
    });

    describe('when the groupByVariable feature toggle is enabled', () => {
      beforeAll(() => {
        config.featureToggles.groupByVariable = true;
      });

      afterAll(() => {
        config.featureToggles.groupByVariable = false;
      });

      it('should handle GroupByVariable', () => {
        const variable = new GroupByVariable({
          name: 'test',
          label: 'test-label',
          description: 'test-desc',
          datasource: { uid: 'fake-uid', type: 'fake-type' },
          defaultOptions: [
            {
              text: 'Foo',
              value: 'foo',
            },
            {
              text: 'Bar',
              value: 'bar',
            },
          ],
        });
        const set = new SceneVariableSet({
          variables: [variable],
        });

        const result = sceneVariablesSetToSchemaV2Variables(set);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchInlineSnapshot(`
      {
        "datasource": {
          "name": "fake-uid",
        },
        "group": "fake-type",
        "kind": "GroupByVariable",
        "spec": {
          "current": {
            "text": [],
            "value": [],
          },
          "defaultValue": undefined,
          "description": "test-desc",
          "hide": "dontHide",
          "label": "test-label",
          "multi": true,
          "name": "test",
          "options": [
            {
              "text": "Foo",
              "value": "foo",
            },
            {
              "text": "Bar",
              "value": "bar",
            },
          ],
          "skipUrlSync": false,
        },
      }
      `);
      });
    });

    describe('when the groupByVariable feature toggle is disabled', () => {
      it('should not handle GroupByVariable and throw an error', () => {
        const variable = new GroupByVariable({
          name: 'test',
          label: 'test-label',
          description: 'test-desc',
          datasource: { uid: 'fake-uid', type: 'fake-type' },
          defaultOptions: [
            {
              text: 'Foo',
              value: 'foo',
            },
            {
              text: 'Bar',
              value: 'bar',
            },
          ],
        });
        const set = new SceneVariableSet({
          variables: [variable],
        });

        expect(() => sceneVariablesSetToSchemaV2Variables(set)).toThrow('Unsupported variable type');
      });
    });
  });
});
