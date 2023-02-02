import { locationService } from '@grafana/runtime';

import { reduxTester } from '../../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../../adapters';
import { createQueryVariableAdapter } from '../../query/adapter';
import { queryBuilder } from '../../shared/testing/builders';
import { getPreloadedState, getRootReducer, RootReducerType } from '../../state/helpers';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { initialVariableModelState, QueryVariableModel, VariableRefresh, VariableSort } from '../../types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../../utils';
import { NavigationKey } from '../types';

import {
  commitChangesToVariable,
  filterOrSearchOptions,
  navigateOptions,
  openOptions,
  toggleOptionByHighlight,
} from './actions';
import {
  hideOptions,
  initialOptionPickerState,
  moveOptionsHighlight,
  showOptions,
  toggleOption,
  updateOptionsAndFilter,
  updateSearchQuery,
} from './reducer';

const datasource = {
  metricFindQuery: jest.fn(() => Promise.resolve([])),
};

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getDataSourceSrv: jest.fn(() => ({
      get: () => datasource,
    })),
    locationService: {
      partial: jest.fn(),
      getSearchObject: () => ({}),
    },
  };
});

describe('options picker actions', () => {
  variableAdapters.setInit(() => [createQueryVariableAdapter()]);

  describe('when navigateOptions is dispatched with navigation key cancel', () => {
    it('then correct actions are dispatched', async () => {
      const variable = createMultiVariable({
        options: [createOption('A', 'A', true)],
        current: createOption(['A'], ['A'], true),
      });

      const clearOthers = false;
      const key = NavigationKey.cancel;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      const option = {
        ...createOption(['A']),
        selected: true,
        value: ['A'],
      };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
        toKeyedAction(
          'key',
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        ),
        toKeyedAction('key', hideOptions())
      );
    });
  });

  describe('when navigateOptions is dispatched with navigation key select without clearOthers', () => {
    it('then correct actions are dispatched', async () => {
      const option = createOption('A', 'A', true);
      const variable = createMultiVariable({
        options: [option],
        current: createOption(['A'], ['A'], true),
        includeAll: false,
      });

      const clearOthers = false;
      const key = NavigationKey.select;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, false))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option, forceSelect: false, clearOthers }))
      );
    });
  });

  describe('when navigateOptions is dispatched with navigation key select with clearOthers', () => {
    it('then correct actions are dispatched', async () => {
      const option = createOption('A', 'A', true);
      const variable = createMultiVariable({
        options: [option],
        current: createOption(['A'], ['A'], true),
        includeAll: false,
      });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option, forceSelect: false, clearOthers }))
      );
    });
  });

  describe('when navigateOptions is dispatched with navigation key select after highlighting the third option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option: options[2], forceSelect: false, clearOthers }))
      );
    });
  });

  describe('when navigateOptions is dispatched with navigation key select after highlighting the second option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option: options[1], forceSelect: false, clearOthers }))
      );
    });
  });

  it('supports having variables with the same label and different values', async () => {
    const options = [createOption('sameLabel', 'A'), createOption('sameLabel', 'B')];
    const variable = createMultiVariable({
      options,
      current: createOption(['sameLabel'], ['A'], true),
      includeAll: false,
    });

    const clearOthers = false;
    const key = NavigationKey.selectAndClose;

    // Open the menu and select the second option
    const tester = await reduxTester<RootReducerType>()
      .givenRootReducer(getRootReducer())
      .whenActionIsDispatched(
        toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
      )
      .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
      .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
      .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
      .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

    const option = createOption(['sameLabel'], ['B'], true);

    // Check selecting the second option triggers variables to update
    tester.thenDispatchedActionsShouldEqual(
      toKeyedAction('key', toggleOption({ option: options[1], forceSelect: true, clearOthers })),
      toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
      toKeyedAction('key', changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))),
      toKeyedAction('key', hideOptions()),
      toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option })))
    );
    expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': ['B'] });
  });

  describe('when navigateOptions is dispatched with navigation key selectAndClose after highlighting the second option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const clearOthers = false;
      const key = NavigationKey.selectAndClose;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions('key', key, clearOthers), true);

      const option = {
        ...createOption(['B']),
        selected: true,
        value: ['B'],
      };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option: options[1], forceSelect: true, clearOthers })),
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
        toKeyedAction(
          'key',
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        ),
        toKeyedAction('key', hideOptions()),
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': ['B'] });
    });
  });

  describe('when filterOrSearchOptions is dispatched with simple filter', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const filter = 'A';

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenAsyncActionIsDispatched(filterOrSearchOptions(toKeyedVariableIdentifier(variable), filter), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', updateSearchQuery(filter)),
        toKeyedAction('key', updateOptionsAndFilter(variable.options))
      );
    });
  });

  describe('when openOptions is dispatched and there is no picker state yet', () => {
    it('then correct actions are dispatched', async () => {
      const variable = queryBuilder()
        .withId('query0')
        .withRootStateKey('key')
        .withName('query0')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState = getPreloadedState('key', {
        variables: {
          [variable.id]: { ...variable },
        },
        optionsPicker: { ...initialOptionPickerState },
      });

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(toKeyedVariableIdentifier(variable), undefined));

      tester.thenDispatchedActionsShouldEqual(toKeyedAction('key', showOptions(variable)));
    });
  });

  describe('when openOptions is dispatched and picker.id is same as variable.id', () => {
    it('then correct actions are dispatched', async () => {
      const variable = queryBuilder()
        .withId('query0')
        .withRootStateKey('key')
        .withName('query0')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState = getPreloadedState('key', {
        variables: {
          [variable.id]: { ...variable },
        },
        optionsPicker: { ...initialOptionPickerState, id: variable.id },
      });

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(toKeyedVariableIdentifier(variable), undefined));

      tester.thenDispatchedActionsShouldEqual(toKeyedAction('key', showOptions(variable)));
    });
  });

  describe('when openOptions is dispatched and picker.id is not the same as variable.id', () => {
    it('then correct actions are dispatched', async () => {
      const variableInPickerState = queryBuilder()
        .withId('query1')
        .withRootStateKey('key')
        .withName('query1')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const variable = queryBuilder()
        .withId('query0')
        .withRootStateKey('key')
        .withName('query0')
        .withMulti()
        .withCurrent(['A'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState = getPreloadedState('key', {
        variables: {
          [variable.id]: { ...variable },
          [variableInPickerState.id]: { ...variableInPickerState },
        },
        optionsPicker: { ...initialOptionPickerState, id: variableInPickerState.id },
      });

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(toKeyedVariableIdentifier(variable), undefined));

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', setCurrentVariableValue({ type: 'query', id: 'query1', data: { option: undefined } })),
        toKeyedAction(
          'key',
          changeVariableProp({ type: 'query', id: 'query1', data: { propName: 'queryValue', propValue: '' } })
        ),
        toKeyedAction('key', hideOptions()),
        toKeyedAction('key', showOptions(variable))
      );
    });
  });

  describe('when commitChangesToVariable is dispatched with no changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenAsyncActionIsDispatched(commitChangesToVariable('key'), true);

      const option = {
        ...createOption(['A']),
        selected: true,
        value: ['A'] as any[],
      };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
        toKeyedAction(
          'key',
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        ),
        toKeyedAction('key', hideOptions())
      );
    });
  });

  describe('when commitChangesToVariable is dispatched with changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight('key', clearOthers))
        .whenAsyncActionIsDispatched(commitChangesToVariable('key'), true);

      const option = {
        ...createOption([]),
        selected: true,
        value: [],
      };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
        toKeyedAction(
          'key',
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        ),
        toKeyedAction('key', hideOptions()),
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': [] });
    });
  });

  describe('when commitChangesToVariable is dispatched with changes and list of options is filtered', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight('key', clearOthers))
        .whenActionIsDispatched(filterOrSearchOptions(toKeyedVariableIdentifier(variable), 'C'))
        .whenAsyncActionIsDispatched(commitChangesToVariable('key'), true);

      const option = {
        ...createOption([]),
        selected: true,
        value: [],
      };

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))),
        toKeyedAction(
          'key',
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: 'C' }))
        ),
        toKeyedAction('key', hideOptions()),
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': [] });
    });
  });

  describe('when toggleOptionByHighlight is dispatched with changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight('key', clearOthers), true);

      const option = createOption('A');

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option, forceSelect: false, clearOthers }))
      );
    });
  });

  describe('when toggleOptionByHighlight is dispatched with changes selected from a filtered options list', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('BC'), createOption('BD')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenActionIsDispatched(toKeyedAction('key', showOptions(variable)))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight('key', clearOthers), true)
        .whenActionIsDispatched(filterOrSearchOptions(toKeyedVariableIdentifier(variable), 'B'))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions('key', NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight('key', clearOthers));

      const optionA = createOption('A');
      const optionBC = createOption('BC');

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', toggleOption({ option: optionA, forceSelect: false, clearOthers })),
        toKeyedAction('key', updateSearchQuery('B')),
        toKeyedAction('key', updateOptionsAndFilter(variable.options)),
        toKeyedAction('key', moveOptionsHighlight(1)),
        toKeyedAction('key', moveOptionsHighlight(1)),
        toKeyedAction('key', toggleOption({ option: optionBC, forceSelect: false, clearOthers }))
      );
    });
  });
});

function createMultiVariable(extend?: Partial<QueryVariableModel>): QueryVariableModel {
  return {
    ...initialVariableModelState,
    type: 'query',
    id: '0',
    rootStateKey: 'key',
    index: 0,
    current: createOption([]),
    options: [],
    query: 'options-query',
    name: 'Constant',
    datasource: { uid: 'datasource' },
    definition: '',
    sort: VariableSort.alphabeticalAsc,
    refresh: VariableRefresh.never,
    regex: '',
    multi: true,
    includeAll: true,
    ...(extend ?? {}),
  };
}

function createOption(text: string | string[], value?: string | string[], selected?: boolean) {
  const metric = createMetric(text);
  return {
    ...metric,
    value: value ?? metric.value,
    selected: selected ?? false,
  };
}

function createMetric(value: string | string[]) {
  return {
    value: value,
    text: value,
  };
}
