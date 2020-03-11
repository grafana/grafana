import { reduxTester } from '../../../../../test/core/redux/reduxTester';
import { getTemplatingRootReducer } from '../../state/helpers';
import { initDashboardTemplating } from '../../state/actions';
import { TemplatingState } from '../../state/reducers';
import { VariableHide, VariableSort, VariableRefresh, QueryVariableModel } from '../../variable';
import {
  showOptions,
  hideOptions,
  toggleOption,
  updateSearchQuery,
  updateOptionsAndFilter,
  toggleTag,
} from './reducer';
import {
  navigateOptions,
  filterOrSearchOptions,
  commitChangesToVariable,
  toggleOptionByHighlight,
  toggleAndFetchTag,
} from './actions';
import { NavigationKey } from '../types';
import { toVariablePayload } from '../../state/types';
import { setCurrentVariableValue, changeVariableProp } from '../../state/sharedReducer';
import { variableAdapters } from '../../adapters';
import { createQueryVariableAdapter } from '../../query/adapter';

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
  };
});

describe('options picker actions', () => {
  variableAdapters.set('query', createQueryVariableAdapter());

  describe('when navigateOptions is dispatched with navigation key cancel', () => {
    it('then correct actions are dispatched', async () => {
      const variable = createVariable({ options: [createOption('A', 'A', true)] });

      const clearOthers = false;
      const key = NavigationKey.cancel;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      const option = {
        ...createOption('A'),
        selected: true,
        value: ['A'],
        tags: [] as any[],
      };

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [setCurrentValue, changeQueryValue, updateOption, hideAction] = actions;
        const expectedNumberOfActions = 4;

        expect(setCurrentValue).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(changeQueryValue).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        );
        expect(updateOption).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(hideAction).toEqual(hideOptions());

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when navigateOptions is dispatched with navigation key select without clearOthers', () => {
    it('then correct actions are dispatched', async () => {
      const option = createOption('A', 'A', true);
      const variable = createVariable({ options: [option], includeAll: false });

      const clearOthers = false;
      const key = NavigationKey.select;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, false))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleOptionAction).toEqual(toggleOption({ option, forceSelect: false, clearOthers }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when navigateOptions is dispatched with navigation key select with clearOthers', () => {
    it('then correct actions are dispatched', async () => {
      const option = createOption('A', 'A', true);
      const variable = createVariable({ options: [option], includeAll: false });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleOptionAction).toEqual(toggleOption({ option, forceSelect: false, clearOthers }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when navigateOptions is dispatched with navigation key select after highlighting the third option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleOptionAction).toEqual(toggleOption({ option: options[2], forceSelect: false, clearOthers }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when navigateOptions is dispatched with navigation key select after highlighting the second option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });

      const clearOthers = true;
      const key = NavigationKey.select;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleOptionAction).toEqual(toggleOption({ option: options[1], forceSelect: false, clearOthers }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when navigateOptions is dispatched with navigation key selectAndClose after highlighting the second option', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });

      const clearOthers = false;
      const key = NavigationKey.selectAndClose;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
        .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true);

      const option = {
        ...createOption('B'),
        selected: true,
        value: ['B'],
        tags: [] as any[],
      };

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction, setCurrentValue, changeQueryValue, updateOption, hideAction] = actions;
        const expectedNumberOfActions = 5;

        expect(toggleOptionAction).toEqual(toggleOption({ option: options[1], forceSelect: false, clearOthers }));
        expect(setCurrentValue).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(changeQueryValue).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        );
        expect(updateOption).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(hideAction).toEqual(hideOptions());

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when filterOrSearchOptions is dispatched with simple filter', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });
      const filter = 'A';

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(filterOrSearchOptions(filter), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [updateQueryValue, updateAndFilter] = actions;
        const expectedNumberOfActions = 2;

        expect(updateQueryValue).toEqual(updateSearchQuery(filter));
        expect(updateAndFilter).toEqual(updateOptionsAndFilter(variable.options));

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when commitChangesToVariable is dispatched with no changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(commitChangesToVariable(), true);

      const option = {
        ...createOption(''),
        selected: true,
        value: [] as any[],
        tags: [] as any[],
      };

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [setCurrentValue, changeQueryValue, hideAction] = actions;
        const expectedNumberOfActions = 3;

        expect(setCurrentValue).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(changeQueryValue).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        );
        expect(hideAction).toEqual(hideOptions());

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when commitChangesToVariable is dispatched with changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))
        .whenAsyncActionIsDispatched(commitChangesToVariable(), true);

      const option = {
        ...createOption('A'),
        selected: true,
        value: ['A'],
        tags: [] as any[],
      };

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [setCurrentValue, changeQueryValue, updateOption, hideAction] = actions;
        const expectedNumberOfActions = 4;

        expect(setCurrentValue).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(changeQueryValue).toEqual(
          changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' }))
        );
        expect(updateOption).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(hideAction).toEqual(hideOptions());

        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when toggleOptionByHighlight is dispatched with changes', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const variable = createVariable({ options, includeAll: false });
      const clearOthers = false;

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
        .whenActionIsDispatched(toggleOptionByHighlight(clearOthers), true);

      const option = createOption('A');

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleOptionAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleOptionAction).toEqual(toggleOption({ option, forceSelect: false, clearOthers }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when toggleAndFetchTag is dispatched with values', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const tag = createTag('tag', []);
      const variable = createVariable({ options, includeAll: false, tags: [tag] });

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(toggleAndFetchTag(tag), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleTagAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleTagAction).toEqual(toggleTag(tag));
        return actions.length === expectedNumberOfActions;
      });
    });
  });

  describe('when toggleAndFetchTag is dispatched without values', () => {
    it('then correct actions are dispatched', async () => {
      const options = [createOption('A'), createOption('B'), createOption('C')];
      const tag = createTag('tag');
      const values = [createMetric('b')];
      const variable = createVariable({ options, includeAll: false, tags: [tag] });

      datasource.metricFindQuery.mockReset();
      datasource.metricFindQuery.mockImplementation(() => Promise.resolve(values));

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenActionIsDispatched(showOptions(variable))
        .whenAsyncActionIsDispatched(toggleAndFetchTag(tag), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [toggleTagAction] = actions;
        const expectedNumberOfActions = 1;

        expect(toggleTagAction).toEqual(toggleTag({ ...tag, values: ['b'] }));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});

function createVariable(extend?: Partial<QueryVariableModel>): QueryVariableModel {
  return {
    type: 'query',
    uuid: '0',
    global: false,
    current: createOption(''),
    options: [],
    query: 'options-query',
    name: 'Constant',
    label: '',
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    index: 0,
    datasource: 'datasource',
    definition: '',
    sort: VariableSort.alphabeticalAsc,
    tags: [],
    tagsQuery: 'tags-query',
    tagValuesQuery: '',
    useTags: true,
    refresh: VariableRefresh.onDashboardLoad,
    regex: '',
    multi: true,
    includeAll: true,
    ...(extend ?? {}),
  };
}

function createOption(text: string, value?: string, selected?: boolean) {
  const metric = createMetric(text);
  return {
    ...metric,
    value: value ?? metric.value,
    selected: selected ?? false,
  };
}

function createMetric(value: string) {
  return {
    value: value,
    text: value,
  };
}

function createTag(name: string, values?: any[]) {
  return {
    selected: false,
    text: name,
    values,
  };
}
