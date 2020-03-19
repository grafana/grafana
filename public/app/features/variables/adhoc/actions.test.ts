import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { getRootReducer } from '../state/helpers';
import { toVariablePayload, toVariableIdentifier } from '../state/types';
import * as variableBuilder from '../testing/variableBuilder';
import {
  applyFilterFromTable,
  AdHocTableOptions,
  changeFilter,
  addFilter,
  removeFilter,
  setFiltersFromUrl,
} from './actions';
import { omit } from 'lodash';
import { filterAdded, filterUpdated, filterRemoved, filtersRestored } from './reducer';
import { addVariable } from '../state/sharedReducer';
import { updateLocation } from 'app/core/actions';
import { DashboardState } from 'app/types';
import { toUrl } from './urlParser';
import { VariableModel } from 'app/features/templating/variable';

const uuid = '0';

jest.mock('uuid', () => ({
  v4: jest.fn(() => uuid),
}));

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
        .adHocVariable()
        .withName('Filters')
        .withFilters([existingFilter])
        .withUUID(uuid)
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(applyFilterFromTable(options), true);

      const variable = variableBuilder
        .adHocVariable()
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
        .adHocVariable()
        .withName('Filters')
        .withUUID(uuid)
        .withFilters([])
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const variable = variableBuilder
        .adHocVariable()
        .withName('Filters')
        .withUUID(uuid)
        .withDatasource(options.datasource)
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const update = { index: 0, filter: updated };

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([filter])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
        .adHocVariable()
        .withUUID(uuid)
        .withFilters([existing])
        .withName('elastic-filter')
        .withDatasource('elasticsearch')
        .build();

      const fromUrl = [
        { ...existing, condition: '>' },
        { ...existing, name: 'value-2' },
      ];

      const tester = await reduxTester<{ templating: TemplatingState; dashboard: DashboardState }>()
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
});

function createAddVariableAction(variable: VariableModel, index = 0) {
  const identifier = toVariableIdentifier(variable);
  const data = { global: false, index, model: variable };
  return addVariable(toVariablePayload(identifier, data));
}
