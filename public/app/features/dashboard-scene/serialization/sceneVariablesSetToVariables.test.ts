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
  QueryVariable,
  SceneVariableSet,
  TextBoxVariable,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { sceneVariablesSetToVariables } from './sceneVariablesSetToVariables';

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
  id: 1,
  uid: 'fake-std',
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
      datasource: { uid: 'fake-std', type: 'fake-std' },
      query: 'query',
      includeAll: true,
      allValue: 'test-all',
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
      "current": {
        "text": [
          "selected-value-text",
        ],
        "value": [
          "selected-value",
        ],
      },
      "datasource": {
        "type": "fake-std",
        "uid": "fake-std",
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
      datasource: { uid: 'fake-std', type: 'fake-std' },
      query: 'query',
      definition: 'query',
      includeAll: true,
      allValue: 'test-all',
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
      "current": {
        "text": [
          "selected-value-text",
        ],
        "value": [
          "selected-value",
        ],
      },
      "datasource": {
        "type": "fake-std",
        "uid": "fake-std",
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
      "type": "query",
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

    const result = sceneVariablesSetToVariables(set);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchInlineSnapshot(`
    {
      "allValue": "test-all",
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
      "options": [],
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
      "query": "text value",
      "skipUrlSync": true,
      "type": "textbox",
    }
    `);
  });

  it('should handle AdHocFiltersVariable', () => {
    const variable = new AdHocFiltersVariable({
      name: 'test',
      label: 'test-label',
      description: 'test-desc',
      datasource: { uid: 'fake-std', type: 'fake-std' },
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
      "baseFilters": [
        {
          "key": "baseFilterTest",
          "operator": "=",
          "value": "test",
        },
      ],
      "datasource": {
        "type": "fake-std",
        "uid": "fake-std",
      },
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
        datasource: { uid: 'fake-std', type: 'fake-std' },
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
        "current": {
          "text": [],
          "value": [],
        },
        "datasource": {
          "type": "fake-std",
          "uid": "fake-std",
        },
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
        datasource: { uid: 'fake-std', type: 'fake-std' },
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
});
