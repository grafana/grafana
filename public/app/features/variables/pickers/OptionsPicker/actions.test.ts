import { reduxTester } from '../../../../../test/core/redux/reduxTester';
import { getRootReducer, RootReducerType } from '../../state/helpers';
import { initialVariableModelState, QueryVariableModel, VariableRefresh, VariableSort } from '../../types';
import {
  hideOptions,
  initialState,
  moveOptionsHighlight,
  showOptions,
  toggleOption,
  updateOptionsAndFilter,
  updateSearchQuery,
} from './reducer';
import {
  commitChangesToVariable,
  filterOrSearchOptions,
  navigateOptions,
  openOptions,
  toggleOptionByHighlight,
} from './actions';
import { NavigationKey } from '../types';
import { toVariablePayload } from '../../state/types';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { variableAdapters } from '../../adapters';
import { createQueryVariableAdapter } from '../../query/adapter';
import { locationService } from '@grafana/runtime';
import { queryBuilder } from '../../shared/testing/builders';

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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      const option = {
        ...createOption(['A']),
        selected: true,
        value: ['A'],
      };

      tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue(toVariablePayload(variable, { option })),
        changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })),
        hideOptions()
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, false))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(toggleOption({ option, forceSelect: false, clearOthers }));
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(toggleOption({ option, forceSelect: false, clearOthers }));
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(toggleOption({ option: options[2], forceSelect: false, clearOthers }));
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionsShouldEqual(toggleOption({ option: options[1], forceSelect: false, clearOthers }));
    });
  });

  describe('when navigateOptions is dispatched with navigation key selectAndClose after highlighting the second option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const clearOthers = false;
      const key = NavigationKey.selectAndClose;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      const option = {
        ...createOption(['B']),
        selected: true,
        value: ['B'],
      };

      tester.thenDispatchedActionsShouldEqual(
        toggleOption({ option: options[1], forceSelect: true, clearOthers }),
        setCurrentVariableValue(toVariablePayload(variable, { option })),
        changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })),
        hideOptions(),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(filterOrSearchOptions(filter), true);

      tester.thenDispatchedActionsShouldEqual(updateSearchQuery(filter), updateOptionsAndFilter(variable.options));
    });
  });

  describe('when openOptions is dispatched and there is no picker state yet', () => {
    it('then correct actions are dispatched', async () => {
      const variable = queryBuilder()
        .withId('query0')
        .withName('query0')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState: any = {
        templating: {
          variables: {
            [variable.id]: { ...variable },
          },
          optionsPicker: { ...initialState },
        },
      };

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(variable, undefined));

      tester.thenDispatchedActionsShouldEqual(showOptions(variable));
    });
  });

  describe('when openOptions is dispatched and picker.id is same as variable.id', () => {
    it('then correct actions are dispatched', async () => {
      const variable = queryBuilder()
        .withId('query0')
        .withName('query0')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState: any = {
        templating: {
          variables: {
            [variable.id]: { ...variable },
          },
          optionsPicker: { ...initialState, id: variable.id },
        },
      };

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(variable, undefined));

      tester.thenDispatchedActionsShouldEqual(showOptions(variable));
    });
  });

  describe('when openOptions is dispatched and picker.id is not the same as variable.id', () => {
    it('then correct actions are dispatched', async () => {
      const variableInPickerState = queryBuilder()
        .withId('query1')
        .withName('query1')
        .withMulti()
        .withCurrent(['A', 'C'])
        .withOptions('A', 'B', 'C')
        .build();

      const variable = queryBuilder()
        .withId('query0')
        .withName('query0')
        .withMulti()
        .withCurrent(['A'])
        .withOptions('A', 'B', 'C')
        .build();

      const preloadedState: any = {
        templating: {
          variables: {
            [variable.id]: { ...variable },
            [variableInPickerState.id]: { ...variableInPickerState },
          },
          optionsPicker: { ...initialState, id: variableInPickerState.id },
        },
      };

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(openOptions(variable, undefined));

      tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue({ type: 'query', id: 'query1', data: { option: undefined } }),
        changeVariableProp({ type: 'query', id: 'query1', data: { propName: 'queryValue', propValue: '' } }),
        hideOptions(),
        showOptions(variable)
      );
    });
  });

  describe('when commitChangesToVariable is dispatched with no changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(commitChangesToVariable(), true);

      const option = {
        ...createOption(['A']),
        selected: true,
        value: ['A'] as any[],
      };

      tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue(toVariablePayload(variable, { option })),
        changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })),
        hideOptions()
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))
        .whenAsyncActionIsDispatched(commitChangesToVariable(), true);

      const option = {
        ...createOption([]),
        selected: true,
        value: [],
      };

      tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue(toVariablePayload(variable, { option })),
        changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })),
        hideOptions(),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))
        .whenActionIsDispatched(filterOrSearchOptions('C'))
        .whenAsyncActionIsDispatched(commitChangesToVariable(), true);

      const option = {
        ...createOption([]),
        selected: true,
        value: [],
      };

      tester.thenDispatchedActionsShouldEqual(
        setCurrentVariableValue(toVariablePayload(variable, { option })),
        changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: 'C' })),
        hideOptions(),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
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
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers), true);

      const option = createOption('A');

      tester.thenDispatchedActionsShouldEqual(toggleOption({ option, forceSelect: false, clearOthers }));
    });
  });

  describe('when toggleOptionByHighlight is dispatched with changes selected from a filtered options list', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('BC'), createOption('BD')];
      const variable = createMultiVariable({ options, current: createOption(['A'], ['A'], true), includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers), true)
        .whenActionIsDispatched(filterOrSearchOptions('B'))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers));

      const optionA = createOption('A');
      const optionBC = createOption('BD');

      tester.thenDispatchedActionsShouldEqual(
        toggleOption({ option: optionA, forceSelect: false, clearOthers }),
        updateSearchQuery('B'),
        updateOptionsAndFilter(variable.options),
        moveOptionsHighlight(1),
        moveOptionsHighlight(1),
        toggleOption({ option: optionBC, forceSelect: false, clearOthers })
      );
    });
  });
});

function createMultiVariable(extend?: Partial<QueryVariableModel>): QueryVariableModel {
  return {
    ...initialVariableModelState,
    type: 'query',
    id: '0',
    index: 0,
    current: createOption([]),
    options: [],
    query: 'options-query',
    name: 'Constant',
    datasource: 'datasource',
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
