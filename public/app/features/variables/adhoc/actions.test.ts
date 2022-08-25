import { DataSourceInstanceSettings, DataSourcePluginMeta, TypedVariableModel } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { changeVariableEditorExtended } from '../editor/reducer';
import { adHocBuilder } from '../shared/testing/builders';
import { getPreloadedState, getRootReducer, RootReducerType } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import {
  addFilter,
  AdHocTableOptions,
  applyFilterFromTable,
  changeFilter,
  changeVariableDatasource,
  removeFilter,
  setFiltersFromUrl,
} from './actions';
import { createAdHocVariableAdapter } from './adapter';
import { filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';

const getList = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({});

locationService.partial = jest.fn();
jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => ({
    get: getDatasource,
    getList,
  })),
}));

variableAdapters.setInit(() => [createAdHocVariableAdapter()]);

const datasources = [
  { ...createDatasource('default', true, true), value: null },
  createDatasource('elasticsearch-v1'),
  createDatasource('loki', false),
  createDatasource('influx'),
  createDatasource('google-sheets', false),
  createDatasource('elasticsearch-v7'),
];

describe('adhoc actions', () => {
  describe('when applyFilterFromTable is dispatched and filter already exist', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const options: AdHocTableOptions = {
        datasource: { uid: 'influxdb' },
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const existingFilter = {
        key: 'filter-key',
        value: 'filter-existing',
        operator: '!=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withFilters([existingFilter])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<RootReducerType>({ preloadedState: getPreloadedState(key, {}) })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedQuery = { 'var-Filters': ['filter-key|!=|filter-existing', 'filter-key|=|filter-value'] };
      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, filterAdded(toVariablePayload(variable, expectedFilter)))
      );

      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when applyFilterFromTable is dispatched and previously no variable or filter exists', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const options: AdHocTableOptions = {
        datasource: { uid: 'influxdb' },
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const tester = await reduxTester<RootReducerType>({ preloadedState: getPreloadedState(key, {}) })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withDatasource(options.datasource)
        .build();

      const expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };
      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        createAddVariableAction(variable),
        toKeyedAction(key, filterAdded(toVariablePayload(variable, expectedFilter)))
      );

      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when applyFilterFromTable is dispatched and previously no filter exists', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const options: AdHocTableOptions = {
        datasource: { uid: 'influxdb' },
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withFilters([])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<RootReducerType>({ preloadedState: getPreloadedState(key, {}) })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
      const expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, filterAdded(toVariablePayload(variable, expectedFilter)))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when applyFilterFromTable is dispatched and adhoc variable with other datasource exists', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const options: AdHocTableOptions = {
        datasource: { uid: 'influxdb' },
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const existing = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<RootReducerType>({ preloadedState: getPreloadedState(key, {}) })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(existing))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
      const expectedQuery = { 'var-elastic-filter': [] as string[], 'var-Filters': ['filter-key|=|filter-value'] };

      tester.thenDispatchedActionsShouldEqual(
        createAddVariableAction(variable, 1),
        toKeyedAction(key, filterAdded(toVariablePayload(variable, expectedFilter)))
      );

      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when changeFilter is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const existing = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const updated = {
        ...existing,
        operator: '!=',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const update = { index: 0, filter: updated };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(changeFilter(toKeyedVariableIdentifier(variable), update), true);

      const expectedQuery = { 'var-elastic-filter': ['key|!=|value'] };
      const expectedUpdate = { index: 0, filter: updated };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, filterUpdated(toVariablePayload(variable, expectedUpdate)))
      );

      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when addFilter is dispatched on variable with existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const existing = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const adding = {
        ...existing,
        operator: '!=',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter(toKeyedVariableIdentifier(variable), adding), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|!=|value'] };
      const expectedFilter = { key: 'key', value: 'value', operator: '!=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, filterAdded(toVariablePayload(variable, expectedFilter)))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when addFilter is dispatched on variable with no existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const adding = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter(toKeyedVariableIdentifier(variable), adding), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value'] };

      tester.thenDispatchedActionsShouldEqual(toKeyedAction(key, filterAdded(toVariablePayload(variable, adding))));
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when removeFilter is dispatched on variable with no existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter(toKeyedVariableIdentifier(variable), 0), true);

      const expectedQuery = { 'var-elastic-filter': [] as string[] };

      tester.thenDispatchedActionsShouldEqual(toKeyedAction(key, filterRemoved(toVariablePayload(variable, 0))));
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when removeFilter is dispatched on variable with existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const filter = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([filter])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter(toKeyedVariableIdentifier(variable), 0), true);

      const expectedQuery = { 'var-elastic-filter': [] as string[] };

      tester.thenDispatchedActionsShouldEqual(toKeyedAction(key, filterRemoved(toVariablePayload(variable, 0))));
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when setFiltersFromUrl is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const existing = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withRootStateKey(key)
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource({ uid: 'elasticsearch' })
        .build();

      const fromUrl = [
        { ...existing, condition: '>' },
        { ...existing, name: 'value-2' },
      ];

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(setFiltersFromUrl(toKeyedVariableIdentifier(variable), fromUrl), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|=|value'] };
      const expectedFilters = [
        { key: 'key', value: 'value', operator: '=', condition: '>' },
        { key: 'key', value: 'value', operator: '=', condition: '', name: 'value-2' },
      ];

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, filtersRestored(toVariablePayload(variable, expectedFilters)))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
    });
  });

  describe('when changeVariableDatasource is dispatched with unsupported datasource', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const datasource = { uid: 'mysql' };
      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withDatasource({ uid: 'influxdb' })
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue(null);
      getList.mockRestore();
      getList.mockReturnValue(datasources);

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(changeVariableDatasource(toKeyedVariableIdentifier(variable), datasource), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(
          key,
          changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
        ),
        toKeyedAction(
          key,
          changeVariableEditorExtended({
            infoText: 'This data source does not support ad hoc filters yet.',
          })
        )
      );
    });
  });

  describe('when changeVariableDatasource is dispatched with datasource', () => {
    it('then correct actions are dispatched', async () => {
      const key = 'key';
      const datasource = { uid: 'elasticsearch' };
      const loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';
      const variable = adHocBuilder()
        .withId('Filters')
        .withRootStateKey(key)
        .withName('Filters')
        .withDatasource({ uid: 'influxdb' })
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue({
        getTagKeys: () => {},
      });
      getList.mockRestore();
      getList.mockReturnValue(datasources);

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(changeVariableDatasource(toKeyedVariableIdentifier(variable), datasource), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(
          key,
          changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
        ),
        toKeyedAction(key, changeVariableEditorExtended({ infoText: loadingText }))
      );
    });
  });
});

function createAddVariableAction(variable: TypedVariableModel, index = 0) {
  const identifier = toKeyedVariableIdentifier(variable);
  const global = false;
  const data = { global, index, model: { ...variable, index: -1, global } };
  return toKeyedAction(variable.rootStateKey!, addVariable(toVariablePayload(identifier, data)));
}

function createDatasource(name: string, selectable = true, isDefault = false): DataSourceInstanceSettings {
  return {
    name,
    meta: {
      mixed: !selectable,
    } as DataSourcePluginMeta,
    isDefault,
    uid: name,
    type: name,
  } as DataSourceInstanceSettings;
}
