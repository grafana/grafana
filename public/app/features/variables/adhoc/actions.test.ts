import { DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';

import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { getRootReducer } from '../state/helpers';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import {
  addFilter,
  AdHocTableOptions,
  applyFilterFromTable,
  changeFilter,
  changeVariableDatasource,
  initAdHocVariableEditor,
  removeFilter,
  setFiltersFromUrl,
} from './actions';
import { filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { updateLocation } from 'app/core/actions';
import { DashboardState, LocationState } from 'app/types';
import { VariableModel } from 'app/features/variables/types';
import { changeVariableEditorExtended, setIdInEditor } from '../editor/reducer';
import { adHocBuilder } from '../shared/testing/builders';

const getMetricSources = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({});

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => ({
    get: getDatasource,
    getMetricSources,
  })),
}));

type ReducersUsedInContext = {
  templating: TemplatingState;
  dashboard: DashboardState;
  location: LocationState;
};

variableAdapters.setInit(() => [createAdHocVariableAdapter()]);

describe('adhoc actions', () => {
  describe('when applyFilterFromTable is dispatched and filter already exist', () => {
    it('then correct actions are dispatched', async () => {
      const options: AdHocTableOptions = {
        datasource: 'influxdb',
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
        .withName('Filters')
        .withFilters([existingFilter])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedQuery = { 'var-Filters': ['filter-key|!=|filter-existing', 'filter-key|=|filter-value'] };
      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        filterAdded(toVariablePayload(variable, expectedFilter)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when applyFilterFromTable is dispatched and previously no variable or filter exists', () => {
    it('then correct actions are dispatched', async () => {
      const options: AdHocTableOptions = {
        datasource: 'influxdb',
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const variable = adHocBuilder()
        .withId('Filters')
        .withName('Filters')
        .withDatasource(options.datasource)
        .build();

      const expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };
      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        createAddVariableAction(variable),
        filterAdded(toVariablePayload(variable, expectedFilter)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when applyFilterFromTable is dispatched and previously no filter exists', () => {
    it('then correct actions are dispatched', async () => {
      const options: AdHocTableOptions = {
        datasource: 'influxdb',
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const variable = adHocBuilder()
        .withId('Filters')
        .withName('Filters')
        .withFilters([])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
      const expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };

      tester.thenDispatchedActionsShouldEqual(
        filterAdded(toVariablePayload(variable, expectedFilter)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when applyFilterFromTable is dispatched and adhoc variable with other datasource exists', () => {
    it('then correct actions are dispatched', async () => {
      const options: AdHocTableOptions = {
        datasource: 'influxdb',
        key: 'filter-key',
        value: 'filter-value',
        operator: '=',
      };

      const existing = adHocBuilder()
        .withId('elastic-filter')
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const variable = adHocBuilder()
        .withId('Filters')
        .withName('Filters')
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(existing))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
      const expectedQuery = { 'var-elastic-filter': [] as string[], 'var-Filters': ['filter-key|=|filter-value'] };

      tester.thenDispatchedActionsShouldEqual(
        createAddVariableAction(variable, 1),
        filterAdded(toVariablePayload(variable, expectedFilter)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when changeFilter is dispatched', () => {
    it('then correct actions are dispatched', async () => {
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
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource('elasticsearch')
        .build();

      const update = { index: 0, filter: updated };

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(changeFilter('elastic-filter', update), true);

      const expectedQuery = { 'var-elastic-filter': ['key|!=|value'] };
      const expectedUpdate = { index: 0, filter: updated };

      tester.thenDispatchedActionsShouldEqual(
        filterUpdated(toVariablePayload(variable, expectedUpdate)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when addFilter is dispatched on variable with existing filter', () => {
    it('then correct actions are dispatched', async () => {
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
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter('elastic-filter', adding), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|!=|value'] };
      const expectedFilter = { key: 'key', value: 'value', operator: '!=', condition: '' };

      tester.thenDispatchedActionsShouldEqual(
        filterAdded(toVariablePayload(variable, expectedFilter)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when addFilter is dispatched on variable with no existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const adding = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withName('elastic-filter')
        .withFilters([])
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter('elastic-filter', adding), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value'] };

      tester.thenDispatchedActionsShouldEqual(
        filterAdded(toVariablePayload(variable, adding)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when removeFilter is dispatched on variable with no existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withName('elastic-filter')
        .withFilters([])
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter('elastic-filter', 0), true);

      const expectedQuery = { 'var-elastic-filter': [] as string[] };

      tester.thenDispatchedActionsShouldEqual(
        filterRemoved(toVariablePayload(variable, 0)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when removeFilter is dispatched on variable with existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const filter = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withName('elastic-filter')
        .withFilters([filter])
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter('elastic-filter', 0), true);

      const expectedQuery = { 'var-elastic-filter': [] as string[] };

      tester.thenDispatchedActionsShouldEqual(
        filterRemoved(toVariablePayload(variable, 0)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when setFiltersFromUrl is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const existing = {
        key: 'key',
        value: 'value',
        operator: '=',
        condition: '',
      };

      const variable = adHocBuilder()
        .withId('elastic-filter')
        .withName('elastic-filter')
        .withFilters([existing])
        .withDatasource('elasticsearch')
        .build();

      const fromUrl = [
        { ...existing, condition: '>' },
        { ...existing, name: 'value-2' },
      ];

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(setFiltersFromUrl('elastic-filter', fromUrl), true);

      const expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|=|value'] };
      const expectedFilters = [
        { key: 'key', value: 'value', operator: '=', condition: '>' },
        { key: 'key', value: 'value', operator: '=', condition: '', name: 'value-2' },
      ];

      tester.thenDispatchedActionsShouldEqual(
        filtersRestored(toVariablePayload(variable, expectedFilters)),
        updateLocation({ query: expectedQuery })
      );
    });
  });

  describe('when initAdHocVariableEditor is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const datasources = [
        createDatasource('elasticsearch-v1'),
        createDatasource('loki', false),
        createDatasource('influx'),
        createDatasource('google-sheets', false),
        createDatasource('elasticsearch-v7'),
      ];

      getMetricSources.mockRestore();
      getMetricSources.mockReturnValue(datasources);

      const tester = reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(initAdHocVariableEditor());

      const expectedDatasources = [
        { text: '', value: '' },
        { text: 'elasticsearch-v1', value: 'elasticsearch-v1' },
        { text: 'influx', value: 'influx' },
        { text: 'elasticsearch-v7', value: 'elasticsearch-v7' },
      ];

      tester.thenDispatchedActionsShouldEqual(
        changeVariableEditorExtended({ propName: 'dataSources', propValue: expectedDatasources })
      );
    });
  });

  describe('when changeVariableDatasource is dispatched with unsupported datasource', () => {
    it('then correct actions are dispatched', async () => {
      const datasource = 'mysql';
      const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';
      const variable = adHocBuilder()
        .withId('Filters')
        .withName('Filters')
        .withDatasource('influxdb')
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue(null);

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
        .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true);

      tester.thenDispatchedActionsShouldEqual(
        changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText }),
        changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })),
        changeVariableEditorExtended({
          propName: 'infoText',
          propValue: 'This datasource does not support adhoc filters yet.',
        })
      );
    });
  });

  describe('when changeVariableDatasource is dispatched with datasource', () => {
    it('then correct actions are dispatched', async () => {
      const datasource = 'elasticsearch';
      const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';
      const variable = adHocBuilder()
        .withId('Filters')
        .withName('Filters')
        .withDatasource('influxdb')
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue({
        getTagKeys: () => {},
      });

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
        .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true);

      tester.thenDispatchedActionsShouldEqual(
        changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText }),
        changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
      );
    });
  });
});

function createAddVariableAction(variable: VariableModel, index = 0) {
  const identifier = toVariableIdentifier(variable);
  const global = false;
  const data = { global, index, model: { ...variable, index: -1, global } };
  return addVariable(toVariablePayload(identifier, data));
}

function createDatasource(name: string, selectable = true): DataSourceSelectItem {
  return {
    name,
    value: name,
    meta: {
      mixed: !selectable,
    } as DataSourcePluginMeta,
    sort: '',
  };
}
