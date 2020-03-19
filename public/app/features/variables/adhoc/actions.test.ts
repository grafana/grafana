import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { getRootReducer } from '../state/helpers';
import { toVariablePayload, toVariableIdentifier } from '../state/types';
import * as variableBuilder from '../testing/variableBuilder';
import { applyFilterFromTable, AdHocTableOptions } from './actions';
import { omit } from 'lodash';
import { filterAdded } from './reducer';
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
});

function createAddVariableAction(variable: VariableModel, index = 0) {
  const identifier = toVariableIdentifier(variable);
  const data = { global: false, index, model: variable };
  return addVariable(toVariablePayload(identifier, data));
}
