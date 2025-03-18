import {
  ConstantVariableModel,
  CustomVariableModel,
  DataSourceVariableModel,
  GroupByVariableModel,
  IntervalVariableModel,
  LoadingState,
  QueryVariableModel,
  TextBoxVariableModel,
  TypedVariableModel,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  QueryVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { defaultDashboard, defaultTimePickerConfig, VariableType } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { SnapshotVariable } from '../serialization/custom-variables/SnapshotVariable';
import { NEW_LINK } from '../settings/links/utils';

import { createSceneVariableFromVariableModel, createVariablesForSnapshot } from './variables';

// mock getDataSourceSrv.getInstanceSettings()
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn(),
  }),
}));

describe('when creating variables objects', () => {
  it('should migrate custom variable', () => {
    const variable: CustomVariableModel = {
      current: {
        selected: false,
        text: 'a',
        value: 'a',
      },
      hide: 0,
      includeAll: false,
      multi: false,
      allowCustomValue: true,
      name: 'query0',
      options: [
        {
          selected: true,
          text: 'a',
          value: 'a',
        },
        {
          selected: false,
          text: 'b',
          value: 'b',
        },
        {
          selected: false,
          text: 'c',
          value: 'c',
        },
        {
          selected: false,
          text: 'd',
          value: 'd',
        },
      ],
      query: 'a,b,c,d',
      skipUrlSync: false,
      type: 'custom',
      rootStateKey: 'N4XLmH5Vz',
      id: 'query0',
      global: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      description: null,
      allValue: null,
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(migrated).toBeInstanceOf(CustomVariable);
    expect(rest).toEqual({
      allValue: undefined,
      defaultToAll: false,
      description: null,
      includeAll: false,
      isMulti: false,
      allowCustomValue: true,
      label: undefined,
      name: 'query0',
      options: [],
      query: 'a,b,c,d',
      skipUrlSync: false,
      text: 'a',
      type: 'custom',
      value: 'a',
      hide: 0,
    });
  });

  it('should migrate query variable with definition', () => {
    const variable: QueryVariableModel = {
      allValue: null,
      allowCustomValue: false,
      current: {
        text: 'America',
        value: 'America',
        selected: false,
      },
      datasource: {
        uid: 'P15396BDD62B2BE29',
        type: 'influxdb',
      },
      definition: 'SHOW TAG VALUES  WITH KEY = "datacenter"',
      hide: 0,
      includeAll: false,
      label: 'Datacenter',
      multi: false,
      name: 'datacenter',
      options: [
        {
          text: 'America',
          value: 'America',
          selected: true,
        },
        {
          text: 'Africa',
          value: 'Africa',
          selected: false,
        },
        {
          text: 'Asia',
          value: 'Asia',
          selected: false,
        },
        {
          text: 'Europe',
          value: 'Europe',
          selected: false,
        },
      ],
      query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
      refresh: 1,
      regex: '',
      skipUrlSync: false,
      sort: 0,
      type: 'query',
      rootStateKey: '000000002',
      id: 'datacenter',
      global: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      description: null,
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(migrated).toBeInstanceOf(QueryVariable);
    expect(rest).toEqual({
      allValue: undefined,
      allowCustomValue: false,
      datasource: {
        type: 'influxdb',
        uid: 'P15396BDD62B2BE29',
      },
      defaultToAll: false,
      description: null,
      includeAll: false,
      isMulti: false,
      label: 'Datacenter',
      name: 'datacenter',
      options: [],
      query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
      refresh: 1,
      regex: '',
      skipUrlSync: false,
      sort: 0,
      text: 'America',
      type: 'query',
      value: 'America',
      hide: 0,
      definition: 'SHOW TAG VALUES  WITH KEY = "datacenter"',
    });
  });

  it('should migrate datasource variable', () => {
    const variable: DataSourceVariableModel = {
      id: 'query1',
      allowCustomValue: true,
      rootStateKey: 'N4XLmH5Vz',
      name: 'query1',
      type: 'datasource',
      global: false,
      index: 1,
      hide: 0,
      skipUrlSync: false,
      state: LoadingState.Done,
      error: null,
      description: null,
      current: {
        value: ['gdev-prometheus', 'gdev-slow-prometheus'],
        text: ['gdev-prometheus', 'gdev-slow-prometheus'],
        selected: true,
      },
      regex: '/^gdev/',
      options: [
        {
          text: 'All',
          value: '$__all',
          selected: false,
        },
        {
          text: 'gdev-prometheus',
          value: 'gdev-prometheus',
          selected: true,
        },
        {
          text: 'gdev-slow-prometheus',
          value: 'gdev-slow-prometheus',
          selected: false,
        },
      ],
      query: 'prometheus',
      multi: true,
      includeAll: true,
      refresh: 1,
      allValue: 'Custom all',
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(migrated).toBeInstanceOf(DataSourceVariable);
    expect(rest).toEqual({
      allValue: 'Custom all',
      allowCustomValue: true,
      defaultToAll: true,
      includeAll: true,
      label: undefined,
      name: 'query1',
      options: [],
      pluginId: 'prometheus',
      regex: '/^gdev/',
      skipUrlSync: false,
      text: ['gdev-prometheus', 'gdev-slow-prometheus'],
      type: 'datasource',
      value: ['gdev-prometheus', 'gdev-slow-prometheus'],
      isMulti: true,
      description: null,
      hide: 0,
      defaultOptionEnabled: false,
    });
  });

  it('should migrate constant variable', () => {
    const variable: ConstantVariableModel = {
      hide: 2,
      label: 'constant',
      name: 'constant',
      skipUrlSync: false,
      type: 'constant',
      rootStateKey: 'N4XLmH5Vz',
      current: {
        selected: true,
        text: 'test',
        value: 'test',
      },
      options: [
        {
          selected: true,
          text: 'test',
          value: 'test',
        },
      ],
      query: 'test',
      id: 'constant',
      global: false,
      index: 3,
      state: LoadingState.Done,
      error: null,
      description: null,
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(rest).toEqual({
      description: null,
      hide: 2,
      label: 'constant',
      name: 'constant',
      skipUrlSync: true,
      type: 'constant',
      value: 'test',
    });
  });

  it('should migrate interval variable', () => {
    const variable: IntervalVariableModel = {
      name: 'intervalVar',
      label: 'Interval Label',
      type: 'interval',
      rootStateKey: 'N4XLmH5Vz',
      auto: false,
      refresh: 2,
      auto_count: 30,
      auto_min: '10s',
      current: {
        selected: true,
        text: '1m',
        value: '1m',
      },
      options: [
        {
          selected: true,
          text: '1m',
          value: '1m',
        },
      ],
      query: '1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d, 7d, 14d, 30d',
      id: 'intervalVar',
      global: false,
      index: 4,
      hide: 0,
      skipUrlSync: false,
      state: LoadingState.Done,
      error: null,
      description: null,
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;
    expect(rest).toEqual({
      label: 'Interval Label',
      autoEnabled: false,
      autoMinInterval: '10s',
      autoStepCount: 30,
      description: null,
      refresh: 2,
      intervals: ['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d'],
      hide: 0,
      name: 'intervalVar',
      skipUrlSync: false,
      type: 'interval',
      value: '1m',
    });
  });

  it('should migrate textbox variable', () => {
    const variable: TextBoxVariableModel = {
      id: 'query0',
      global: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      name: 'textboxVar',
      label: 'Textbox Label',
      description: 'Textbox Description',
      type: 'textbox',
      rootStateKey: 'N4XLmH5Vz',
      current: {},
      hide: 0,
      options: [],
      query: 'defaultValue',
      originalQuery: 'defaultValue',
      skipUrlSync: false,
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;
    expect(rest).toEqual({
      description: 'Textbox Description',
      hide: 0,
      label: 'Textbox Label',
      name: 'textboxVar',
      skipUrlSync: false,
      type: 'textbox',
      value: 'defaultValue',
    });
  });

  it('should migrate adhoc variable', () => {
    const variable: TypedVariableModel = {
      id: 'adhoc',
      allowCustomValue: false,
      global: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      name: 'adhoc',
      label: 'Adhoc Label',
      description: 'Adhoc Description',
      type: 'adhoc',
      rootStateKey: 'N4XLmH5Vz',
      datasource: {
        uid: 'gdev-prometheus',
        type: 'prometheus',
      },
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
      hide: 0,
      skipUrlSync: false,
    };

    const migrated = createSceneVariableFromVariableModel(variable) as AdHocFiltersVariable;
    const filterVarState = migrated.state;

    expect(migrated).toBeInstanceOf(AdHocFiltersVariable);
    expect(filterVarState).toEqual({
      key: expect.any(String),
      description: 'Adhoc Description',
      allowCustomValue: false,
      hide: 0,
      label: 'Adhoc Label',
      name: 'adhoc',
      skipUrlSync: false,
      type: 'adhoc',
      filterExpression: 'filterTest="test"',
      filters: [{ key: 'filterTest', operator: '=', value: 'test' }],
      baseFilters: [{ key: 'baseFilterTest', operator: '=', value: 'test' }],
      datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
      applyMode: 'auto',
      useQueriesAsFilterForOptions: true,
      supportsMultiValueOperators: false,
    });
  });

  it('should migrate adhoc variable with default keys', () => {
    const variable: TypedVariableModel = {
      id: 'adhoc',
      global: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      name: 'adhoc',
      label: 'Adhoc Label',
      description: 'Adhoc Description',
      type: 'adhoc',
      rootStateKey: 'N4XLmH5Vz',
      datasource: {
        uid: 'gdev-prometheus',
        type: 'prometheus',
      },
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
      hide: 0,
      skipUrlSync: false,
    };

    const migrated = createSceneVariableFromVariableModel(variable) as AdHocFiltersVariable;
    const filterVarState = migrated.state;

    expect(migrated).toBeInstanceOf(AdHocFiltersVariable);
    expect(filterVarState).toEqual({
      key: expect.any(String),
      description: 'Adhoc Description',
      hide: 0,
      label: 'Adhoc Label',
      name: 'adhoc',
      skipUrlSync: false,
      type: 'adhoc',
      filterExpression: 'filterTest="test"',
      filters: [{ key: 'filterTest', operator: '=', value: 'test' }],
      baseFilters: [{ key: 'baseFilterTest', operator: '=', value: 'test' }],
      datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
      applyMode: 'auto',
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
      useQueriesAsFilterForOptions: true,
      supportsMultiValueOperators: false,
    });
  });

  describe('when groupByVariable feature toggle is enabled', () => {
    beforeAll(() => {
      config.featureToggles.groupByVariable = true;
    });

    afterAll(() => {
      config.featureToggles.groupByVariable = false;
    });

    it('should migrate groupby variable', () => {
      const variable: GroupByVariableModel = {
        id: 'groupby',
        global: false,
        index: 0,
        state: LoadingState.Done,
        error: null,
        name: 'groupby',
        label: 'GroupBy Label',
        description: 'GroupBy Description',
        type: 'groupby',
        rootStateKey: 'N4XLmH5Vz',
        datasource: {
          uid: 'gdev-prometheus',
          type: 'prometheus',
        },
        multi: true,
        allowCustomValue: true,
        options: [
          {
            selected: false,
            text: 'Foo',
            value: 'foo',
          },
          {
            selected: false,
            text: 'Bar',
            value: 'bar',
          },
        ],
        current: {},
        query: '',
        hide: 0,
        skipUrlSync: false,
      };

      const migrated = createSceneVariableFromVariableModel(variable) as GroupByVariable;
      const groupbyVarState = migrated.state;

      expect(migrated).toBeInstanceOf(GroupByVariable);
      expect(groupbyVarState).toEqual({
        key: expect.any(String),
        description: 'GroupBy Description',
        hide: 0,
        defaultOptions: [
          {
            selected: false,
            text: 'Foo',
            value: 'foo',
          },
          {
            selected: false,
            text: 'Bar',
            value: 'bar',
          },
        ],
        isMulti: true,
        layout: 'horizontal',
        noValueOnClear: true,
        label: 'GroupBy Label',
        name: 'groupby',
        skipUrlSync: false,
        type: 'groupby',
        baseFilters: [],
        options: [],
        text: [],
        value: [],
        datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
        applyMode: 'auto',
        allowCustomValue: true,
      });
    });
  });

  describe('when groupByVariable feature toggle is disabled', () => {
    it('should not migrate groupby variable and throw an error instead', () => {
      const variable: GroupByVariableModel = {
        id: 'groupby',
        global: false,
        index: 0,
        state: LoadingState.Done,
        error: null,
        name: 'groupby',
        label: 'GroupBy Label',
        description: 'GroupBy Description',
        type: 'groupby',
        rootStateKey: 'N4XLmH5Vz',
        datasource: {
          uid: 'gdev-prometheus',
          type: 'prometheus',
        },
        multi: true,
        options: [],
        current: {},
        query: '',
        hide: 0,
        skipUrlSync: false,
      };

      expect(() => createSceneVariableFromVariableModel(variable)).toThrow('Scenes: Unsupported variable type');
    });
  });

  it.each(['system'])('should throw for unsupported (yet) variables', (type) => {
    const variable = {
      name: 'query0',
      type: type as VariableType,
    };

    expect(() => createSceneVariableFromVariableModel(variable as TypedVariableModel)).toThrow();
  });

  it('should handle variable without current', () => {
    // @ts-expect-error
    const variable: TypedVariableModel = {
      id: 'query1',
      name: 'query1',
      type: 'datasource',
      global: false,
      regex: '/^gdev/',
      options: [],
      query: 'prometheus',
      multi: true,
      includeAll: true,
      refresh: 1,
      allValue: 'Custom all',
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(migrated).toBeInstanceOf(DataSourceVariable);
    expect(rest).toEqual({
      allValue: 'Custom all',
      defaultToAll: true,
      includeAll: true,
      label: undefined,
      name: 'query1',
      options: [],
      pluginId: 'prometheus',
      regex: '/^gdev/',
      text: '',
      type: 'datasource',
      value: '',
      isMulti: true,
      defaultOptionEnabled: false,
    });
  });

  it('should handle datasource variable with default selected', () => {
    // @ts-expect-error
    const variable: TypedVariableModel = {
      id: 'query1',
      current: {
        text: 'default',
        value: 'default',
        selected: true,
      },
      name: 'query1',
      type: 'datasource',
      global: false,
      regex: '/^gdev/',
      options: [],
      query: 'prometheus',
      multi: true,
      includeAll: true,
      refresh: 1,
      allValue: 'Custom all',
    };

    const migrated = createSceneVariableFromVariableModel(variable);
    const { key, ...rest } = migrated.state;

    expect(migrated).toBeInstanceOf(DataSourceVariable);
    expect(rest).toEqual({
      allValue: 'Custom all',
      defaultToAll: true,
      includeAll: true,
      label: undefined,
      name: 'query1',
      options: [],
      pluginId: 'prometheus',
      regex: '/^gdev/',
      text: 'default',
      type: 'datasource',
      value: 'default',
      isMulti: true,
      defaultOptionEnabled: true,
    });
  });
});

describe('when creating snapshot variables from dashboard model', () => {
  it('should create SnapshotVariables when required', () => {
    const customVariable = {
      current: {
        selected: false,
        text: 'a',
        value: 'a',
      },
      hide: 0,
      includeAll: false,
      multi: false,
      name: 'custom0',
      options: [],
      query: 'a,b,c,d',
      skipUrlSync: false,
      type: 'custom' as VariableType,
      rootStateKey: 'N4XLmH5Vz',
    };

    const intervalVariable = {
      current: {
        selected: false,
        text: '10s',
        value: '10s',
      },
      hide: 0,
      includeAll: false,
      multi: false,
      name: 'interval0',
      options: [],
      query: '10s,20s,30s',
      skipUrlSync: false,
      type: 'interval' as VariableType,
      rootStateKey: 'N4XLmH5Vz',
    };

    const adHocVariable = {
      global: false,
      name: 'CoolFilters',
      label: 'CoolFilters Label',
      type: 'adhoc' as VariableType,
      datasource: {
        uid: 'gdev-prometheus',
        type: 'prometheus',
      },
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
      hide: 0,
      index: 0,
    };

    const snapshot = {
      ...defaultDashboard,
      title: 'snapshot dash',
      uid: 'test-uid',
      time: { from: 'now-10h', to: 'now' },
      weekStart: 'saturday',
      fiscalYearStartMonth: 2,
      timezone: 'America/New_York',
      timepicker: {
        ...defaultTimePickerConfig,
        hidden: true,
      },
      links: [{ ...NEW_LINK, title: 'Link 1' }],
      templating: {
        list: [customVariable, adHocVariable, intervalVariable],
      },
    };

    const oldModel = new DashboardModel(snapshot, { isSnapshot: true });
    const variables = createVariablesForSnapshot(oldModel);

    // check variables were converted to snapshot variables
    expect(variables).toBeInstanceOf(SceneVariableSet);
    expect(variables.getByName('custom0')).toBeInstanceOf(SnapshotVariable);
    expect(variables?.getByName('CoolFilters')).toBeInstanceOf(AdHocFiltersVariable);
    expect(variables?.getByName('interval0')).toBeInstanceOf(SnapshotVariable);
    // // custom snapshot
    const customSnapshot = variables?.getByName('custom0') as SnapshotVariable;
    expect(customSnapshot.state.value).toBe('a');
    expect(customSnapshot.state.text).toBe('a');
    expect(customSnapshot.state.isReadOnly).toBe(true);
    // // adhoc snapshot
    const adhocSnapshot = variables?.getByName('CoolFilters') as AdHocFiltersVariable;
    expect(adhocSnapshot.state.filters).toEqual(adHocVariable.filters);
    expect(adhocSnapshot.state.readOnly).toBe(true);
    //
    // // interval snapshot
    const intervalSnapshot = variables?.getByName('interval0') as SnapshotVariable;
    expect(intervalSnapshot.state.value).toBe('10s');
    expect(intervalSnapshot.state.text).toBe('10s');
    expect(intervalSnapshot.state.isReadOnly).toBe(true);
  });
});
