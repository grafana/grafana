import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { getRootReducer } from '../state/helpers';
import { toVariablePayload, toVariableIdentifier } from '../state/types';
import * as variableBuilder from '../shared/testing/builders';
import {
  applyFilterFromTable,
  AdHocTableOptions,
  changeFilter,
  addFilter,
  removeFilter,
  setFiltersFromUrl,
  initAdHocVariableEditor,
  changeVariableDatasource,
} from './actions';
import { omit } from 'lodash';
import { filterAdded, filterUpdated, filterRemoved, filtersRestored } from './reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { updateLocation } from 'app/core/actions';
import { DashboardState, LocationState } from 'app/types';
import { toUrl } from './urlParser';
import { VariableModel } from 'app/features/templating/variable';
import { changeVariableEditorExtended, setIdInEditor } from '../editor/reducer';
import { DataSourceSelectItem, DataSourcePluginMeta } from '@grafana/data';

const uuid = '0';
const getMetricSources = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({});

jest.mock('uuid', () => ({
  v4: jest.fn(() => uuid),
}));

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

describe('adhoc actions', () => {
  variableAdapters.set('adhoc', createAdHocVariableAdapter());

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

      const variable = variableBuilder
        .adHoc()
        .withName('Filters')
        .withFilters([existingFilter])
        .withUUID(uuid)
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const addedFilter = {
        ...omit(options, 'datasource'),
        condition: '',
      };

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [addFilterAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { 'var-Filters': toUrl([existingFilter, addedFilter]) };
        expect(addFilterAction).toEqual(filterAdded(toVariablePayload(variable, addedFilter)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withName('Filters')
        .withUUID(uuid)
        .withDatasource(options.datasource)
        .build();

      const filter = {
        ...omit(options, 'datasource'),
        condition: '',
      };

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [addVariableAction, addFilterAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 3;

        const query = { 'var-Filters': toUrl([filter]) };

        expect(addVariableAction).toEqual(createAddVariableAction(variable));
        expect(addFilterAction).toEqual(filterAdded(toVariablePayload(variable, filter)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withName('Filters')
        .withUUID(uuid)
        .withFilters([])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const filter = {
        ...omit(options, 'datasource'),
        condition: '',
      };

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [addFilterAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { 'var-Filters': toUrl([filter]) };
        expect(addFilterAction).toEqual(filterAdded(toVariablePayload(variable, filter)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const existing = variableBuilder
        .adHoc()
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const variable = variableBuilder
        .adHoc()
        .withName('Filters')
        .withUUID(uuid)
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(existing))
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const filter = {
        ...omit(options, 'datasource'),
        condition: '',
      };

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [addVariableAction, addFilterAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 3;

        const query = { 'var-Filters': toUrl([filter]) };

        expect(addVariableAction).toEqual(createAddVariableAction(variable, 1));
        expect(addFilterAction).toEqual(filterAdded(toVariablePayload(variable, filter)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const update = { index: 0, filter: updated };

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(changeFilter(uuid, update), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterUpdatedAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl([updated]) };

        expect(filterUpdatedAction).toEqual(filterUpdated(toVariablePayload(variable, update)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter(uuid, adding), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterAddAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl([existing, adding]) };

        expect(filterAddAction).toEqual(filterAdded(toVariablePayload(variable, adding)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(addFilter(uuid, adding), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterAddAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl([adding]) };

        expect(filterAddAction).toEqual(filterAdded(toVariablePayload(variable, adding)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when removeFilter is dispatched on variable with no existing filter', () => {
    it('then correct actions are dispatched', async () => {
      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter(uuid, 0), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterRemoveAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl([]) };

        expect(filterRemoveAction).toEqual(filterRemoved(toVariablePayload(variable, 0)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([filter])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(removeFilter(uuid, 0), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterRemoveAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl([]) };

        expect(filterRemoveAction).toEqual(filterRemoved(toVariablePayload(variable, 0)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const fromUrl = [
        { ...existing, condition: '>' },
        { ...existing, name: 'value-2' },
      ];

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenAsyncActionIsDispatched(setFiltersFromUrl(uuid, fromUrl), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [filterRestoredAction, updateLocationAction] = actions;
        const expectedNumberOfActions = 2;

        const query = { [`var-${variable.name}`]: toUrl(fromUrl) };

        expect(filterRestoredAction).toEqual(filtersRestored(toVariablePayload(variable, fromUrl)));
        expect(updateLocationAction).toEqual(updateLocation({ query }));

        return actions.length === expectedNumberOfActions;
      });
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

      const selectable = [
        createDatasource(''),
        createDatasource('elasticsearch-v1'),
        createDatasource('influx'),
        createDatasource('elasticsearch-v7'),
      ];

      getMetricSources.mockRestore();
      getMetricSources.mockReturnValue(datasources);

      const tester = reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(initAdHocVariableEditor());

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [changeEditorAction] = actions;
        const expectedNumberOfActions = 1;

        expect(changeEditorAction).toEqual(
          changeVariableEditorExtended({
            propName: 'dataSources',
            propValue: selectable.map(ds => ({ text: ds.name, value: ds.value })),
          })
        );

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when changeVariableDatasource is dispatched with unsupported datasource', () => {
    it('then correct actions are dispatched', async () => {
      const datasource = 'mysql';
      const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';
      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withDatasource('influxdb')
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue(null);

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenActionIsDispatched(setIdInEditor({ id: variable.uuid! }))
        .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [loadingTextAction, changePropAction, unsupportedTextAction] = actions;
        const expectedNumberOfActions = 3;

        expect(loadingTextAction).toEqual(
          changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText })
        );
        expect(changePropAction).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
        );
        expect(unsupportedTextAction).toEqual(
          changeVariableEditorExtended({
            propName: 'infoText',
            propValue: 'This datasource does not support adhoc filters yet.',
          })
        );

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when changeVariableDatasource is dispatched with datasource', () => {
    it('then correct actions are dispatched', async () => {
      const datasource = 'elasticsearch';
      const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';
      const variable = variableBuilder
        .adHoc()
        .withUUID(uuid)
        .withDatasource('influxdb')
        .build();

      getDatasource.mockRestore();
      getDatasource.mockResolvedValue({
        getTagKeys: () => {},
      });

      const tester = await reduxTester<ReducersUsedInContext>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(createAddVariableAction(variable))
        .whenActionIsDispatched(setIdInEditor({ id: variable.uuid! }))
        .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [loadingTextAction, changePropAction] = actions;
        const expectedNumberOfActions = 2;

        expect(loadingTextAction).toEqual(
          changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText })
        );
        expect(changePropAction).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
        );

        return actions.length === expectedNumberOfActions;
      });
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
