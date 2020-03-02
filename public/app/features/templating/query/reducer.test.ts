import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import {
  initialQueryVariableModelState,
  initialQueryVariablePickerState,
  QueryVariableEditorState,
  QueryVariablePickerState,
  queryVariableReducer,
  QueryVariableState,
} from './reducer';
import {
  addVariable,
  changeVariableProp,
  hideVariableDropDown,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  showVariableDropDown,
  toggleAllVariableOptions,
  toVariablePayload,
  updateVariableOptions,
  updateVariableTags,
} from '../state/actions';
import { QueryVariableModel, VariableModel, VariableOption, VariableTag } from '../variable';
import cloneDeep from 'lodash/cloneDeep';
import { Deferred } from '../deferred';
import { changeQueryVariableHighlightIndex, changeQueryVariableSearchQuery, toggleVariableTag } from './actions';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../state/types';

describe('queryVariableReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model = ({ name: 'name from model', type: 'type from model' } as unknown) as QueryVariableModel;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { global: true, index: 0, model });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialTemplatingState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState.variables[0].variable;
          const expectedState = { ...initialQueryVariableModelState };
          delete expectedState.initLock;
          expect(resultingRest).toEqual({
            ...expectedState,
            uuid: '0',
            index: 0,
            global: true,
            name: 'name from model',
            type: 'type from model',
          });
          expect(resultingState.variables[0].picker).toEqual(initialQueryVariablePickerState);
          // make sure that initLock is defined
          expect(resultingState.variables[0].variable.initLock!).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.promise).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.resolve).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.reject).toBeDefined();
          return true;
        });
    });
  });

  const getVariableTestContext = (
    variableOverrides: Partial<QueryVariableModel> = {},
    editorOverrides: Partial<QueryVariableEditorState> = {},
    pickerOverrides: Partial<QueryVariablePickerState> = {}
  ) => {
    const defaultVariable = {
      ...initialQueryVariableModelState,
      uuid: '0',
      index: 0,
      name: '0',
    };
    const variable = { ...defaultVariable, ...variableOverrides };
    const picker = { ...initialQueryVariablePickerState, ...pickerOverrides };
    const initialState: TemplatingState = {
      variables: {
        '0': {
          variable,
          picker,
        },
      },
      uuidInEditor: null,
    };

    return { initialState };
  };

  describe('when updateVariableOptions is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: false },
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'All', value: '$__all', selected: false }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'None', value: '', selected: false, isNone: true }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: false },
                  { text: 'A', value: 'A', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'A', value: 'A', selected: false }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableTags is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const tags: any[] = [{ text: 'A' }, { text: 'B' }];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, tags);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableTags(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                tags: [
                  { text: 'A', selected: false },
                  { text: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.text is an Array with values', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ['A', 'B'], selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'A + B', value: ['A', 'B'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'A + B',
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                selectedValues: [
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values except All value', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: 'A + B', selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'A + B', value: ['A', 'B'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'A + B',
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                selectedValues: [
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values containing All value', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'All', value: ['$__all'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'All',
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ selected: true, text: 'All', value: '$__all' }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when resolveInitLock is dispatched', () => {
    it('then state should be correct', () => {
      const initLock = ({
        resolve: jest.fn(),
        reject: jest.fn(),
        promise: jest.fn(),
      } as unknown) as Deferred;
      const { initialState } = getVariableTestContext({ initLock });
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(resolveInitLock(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState.variables[0].variable;
          const expectedState = cloneDeep(initialState);
          delete expectedState.variables[0].variable.initLock;
          expect(resultingRest).toEqual(expectedState.variables[0].variable);
          expect(resultingState.uuidInEditor).toEqual(expectedState.uuidInEditor);
          expect(resultingState.variables[0].picker).toEqual(expectedState.variables[0].picker);
          // make sure that initLock is defined
          expect(resultingState.variables[0].variable.initLock!).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.promise).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.resolve).toBeDefined();
          expect(resultingState.variables[0].variable.initLock!.resolve).toHaveBeenCalledTimes(1);
          expect(resultingState.variables[0].variable.initLock!.reject).toBeDefined();
          return true;
        });
    });
  });

  describe('when removeInitLock is dispatched', () => {
    it('then state should be correct', () => {
      const initLock = ({
        resolve: jest.fn(),
        reject: jest.fn(),
        promise: jest.fn(),
      } as unknown) as Deferred;
      const { initialState } = getVariableTestContext({ initLock });
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(removeInitLock(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                initLock: null,
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when showVariableDropDown is dispatched and picker has an oldVariableText and searchQuery and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const oldVariableText = 'A';
      const query = '*.__searchFilter';
      const searchQuery = 'a search query';
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const { initialState } = getVariableTestContext(
        {
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          query,
          current,
        },
        {},
        {
          oldVariableText,
          searchQuery,
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showVariableDropDown(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'A',
                highlightIndex: -1,
                searchQuery: 'a search query',
                showDropDown: true,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when showVariableDropDown is dispatched and picker has no oldVariableText but searchQuery and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const oldVariableText: any = null;
      const query = '*.__searchFilter';
      const searchQuery = 'a search query';
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const { initialState } = getVariableTestContext(
        {
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          query,
          current,
        },
        {},
        {
          oldVariableText,
          searchQuery,
        }
      );
      (initialState.variables[0].picker as any).oldVariableText = oldVariableText;
      (initialState.variables[0].picker as any).searchQuery = searchQuery;
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showVariableDropDown(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'All',
                highlightIndex: -1,
                searchQuery: 'a search query',
                showDropDown: true,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when showVariableDropDown is dispatched and picker has no oldVariableText and searchQuery and variable has no searchFilter', () => {
    it('then state should be correct', () => {
      const oldVariableText: any = null;
      const query = '*.';
      const searchQuery: any = null;
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const { initialState } = getVariableTestContext(
        {
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          query,
          current,
        },
        {},
        {
          oldVariableText,
          searchQuery,
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showVariableDropDown(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'All',
                highlightIndex: -1,
                searchQuery: '',
                showDropDown: true,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when showVariableDropDown is dispatched all other pickers are hidden', () => {
    it('then state should be correct', () => {
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: true },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        current,
      });
      const varibleWithOpenPicker = cloneDeep<QueryVariableState>(
        (initialState.variables[0] as unknown) as QueryVariableState
      );
      varibleWithOpenPicker.picker.showDropDown = true;
      varibleWithOpenPicker.variable.uuid = '1';
      varibleWithOpenPicker.variable.index = 1;
      const otherVariable = cloneDeep<QueryVariableState>((initialState.variables[0] as unknown) as QueryVariableState);
      otherVariable.picker.showDropDown = false;
      otherVariable.variable.uuid = '2';
      otherVariable.variable.index = 2;
      const allState: TemplatingState = {
        ...initialState,
        variables: {
          ...initialState.variables,
          '1': varibleWithOpenPicker,
          '2': otherVariable,
        },
      };

      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(allState))
        .whenActionIsDispatched(showVariableDropDown(payload))
        .thenStateShouldEqual({
          ...allState,
          variables: {
            '0': {
              ...allState.variables[0],
              variable: ({
                ...allState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...allState.variables[0].picker,
                oldVariableText: 'All',
                highlightIndex: -1,
                searchQuery: '',
                showDropDown: true,
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
              },
            },
            '1': {
              ...allState.variables[1],
              variable: ({
                ...allState.variables[1].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...allState.variables[1].picker,
                showDropDown: false,
              },
            },
            '2': {
              ...allState.variables[2],
              variable: ({
                ...allState.variables[2].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { text: 'All', value: ['$__all'], selected: true },
              } as unknown) as VariableModel,
              picker: {
                ...allState.variables[2].picker,
                showDropDown: false,
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when hideVariableDropDown is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        },
        {},
        {
          oldVariableText: 'All',
          searchQuery: 'a search',
          highlightIndex: 1,
          showDropDown: true,
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(hideVariableDropDown(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'All',
                highlightIndex: 1,
                searchQuery: 'a search',
                showDropDown: false,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  // describe('when changeVariableNameSucceeded is dispatched and there are other errors', () => {
  //   it('then state should be correct', () => {
  //     const { initialState } = getVariableTestContext(
  //       {},
  //       {
  //         errors: { name: 'A variable with that name already exists', update: 'Update failed' },
  //         name: 'Name-0',
  //       }
  //     );
  //     const newName = 'New name';
  //     const payload = toVariablePayload({ uuid: '0', type: 'query' }, newName);
  //     reducerTester<TemplatingState>()
  //       .givenReducer(queryVariableReducer, cloneDeep(initialState))
  //       .whenActionIsDispatched(changeVariableNameSucceeded(payload))
  //       .thenStateShouldEqual({
  //         ...initialState,
  //         variables: {
  //           '0': {
  //             ...initialState.variables[0],
  //             variable: ({
  //               ...initialState.variables[0].variable,
  //               name: 'New name',
  //             } as unknown) as VariableModel,
  //             editor: {
  //               ...initialState.variables[0].editor,
  //               name: 'New name',
  //               errors: { update: 'Update failed' },
  //               isValid: false,
  //             },
  //           },
  //         },
  //         uuidInEditor: null,
  //       });
  //   });
  // });

  // describe('when changeVariableNameSucceeded is dispatched and there no other errors', () => {
  //   it('then state should be correct', () => {
  //     const { initialState } = getVariableTestContext(
  //       {},
  //       {
  //         errors: { name: 'A variable with that name already exists' },
  //         name: 'Name-0',
  //         isValid: false,
  //       }
  //     );
  //     const newName = 'New name';
  //     const payload = toVariablePayload({ uuid: '0', type: 'query' }, newName);
  //     reducerTester<TemplatingState>()
  //       .givenReducer(queryVariableReducer, cloneDeep(initialState))
  //       .whenActionIsDispatched(changeVariableNameSucceeded(payload))
  //       .thenStateShouldEqual({
  //         ...initialState,
  //         variables: {
  //           '0': {
  //             ...initialState.variables[0],
  //             variable: ({
  //               ...initialState.variables[0].variable,
  //               name: 'New name',
  //             } as unknown) as VariableModel,
  //             editor: {
  //               ...initialState.variables[0].editor,
  //               name: 'New name',
  //               errors: {},
  //               isValid: true,
  //             },
  //           },
  //         },
  //         uuidInEditor: null,
  //       });
  //   });
  // });

  // describe('when changeVariableNameFailed is dispatched', () => {
  //   it('then state should be correct', () => {
  //     const { initialState } = getVariableTestContext(
  //       {},
  //       {
  //         errors: {},
  //         name: 'Name-0',
  //         isValid: true,
  //       }
  //     );
  //     const newName = 'New name';
  //     const payload = toVariablePayload({ uuid: '0', type: 'query' }, { newName, errorText: 'Name already exists' });
  //     reducerTester<TemplatingState>()
  //       .givenReducer(queryVariableReducer, cloneDeep(initialState))
  //       .whenActionIsDispatched(changeVariableNameFailed(payload))
  //       .thenStateShouldEqual({
  //         ...initialState,
  //         variables: {
  //           '0': {
  //             ...initialState.variables[0],
  //             variable: ({
  //               ...initialState.variables[0].variable,
  //             } as unknown) as VariableModel,
  //             editor: {
  //               ...initialState.variables[0].editor,
  //               name: 'New name',
  //               errors: { name: 'Name already exists' },
  //               isValid: false,
  //             },
  //           },
  //         },
  //         uuidInEditor: null,
  //       });
  //   });
  // });

  // describe('when queryVariableDatasourceLoaded is dispatched', () => {
  //   it('then state should be correct', () => {
  //     const { initialState } = getVariableTestContext();
  //     const dataSource = ({ id: 'mock-data', name: 'MockData' } as unknown) as DataSourceApi;
  //     const payload = toVariablePayload({ uuid: '0', type: 'query' }, dataSource);
  //     reducerTester<TemplatingState>()
  //       .givenReducer(queryVariableReducer, cloneDeep(initialState))
  //       .whenActionIsDispatched(queryVariableDatasourceLoaded(payload))
  //       .thenStateShouldEqual({
  //         ...initialState,
  //         variables: {
  //           '0': {
  //             ...initialState.variables[0],
  //             variable: ({
  //               ...initialState.variables[0].variable,
  //             } as unknown) as VariableModel,
  //             editor: ({
  //               ...initialState.variables[0].editor,
  //               dataSource,
  //             } as unknown) as QueryVariableEditorState,
  //           },
  //         },
  //         uuidInEditor: null,
  //       });
  //   });
  // });

  // describe('when queryVariableQueryEditorLoaded is dispatched', () => {
  //   it('then state should be correct', () => {
  //     const { initialState } = getVariableTestContext();
  //     const VariableQueryEditor = DefaultVariableQueryEditor;
  //     const payload = toVariablePayload({ uuid: '0', type: 'query' }, VariableQueryEditor);
  //     reducerTester<TemplatingState>()
  //       .givenReducer(queryVariableReducer, cloneDeep(initialState))
  //       .whenActionIsDispatched(queryVariableQueryEditorLoaded(payload))
  //       .thenStateShouldEqual({
  //         ...initialState,
  //         variables: {
  //           '0': {
  //             ...initialState.variables[0],
  //             variable: ({
  //               ...initialState.variables[0].variable,
  //             } as unknown) as VariableModel,
  //             editor: ({
  //               ...initialState.variables[0].editor,
  //               VariableQueryEditor,
  //             } as unknown) as QueryVariableEditorState,
  //           },
  //         },
  //         uuidInEditor: null,
  //       });
  //   });
  // });

  describe('when changeVariableProp is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const propName = 'useTags';
      const propValue = true;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { propName, propValue });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableProp(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                useTags: true,
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when toggleVariableTag is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        tags: [
          { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] },
          { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
          { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
        ],
        options: [
          { text: 'A', selected: false, value: 'A' },
          { text: 'AA', selected: false, value: 'AA' },
          { text: 'AAA', selected: false, value: 'AAA' },
        ],
      });
      const tag: VariableTag = { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, tag);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleVariableTag(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                tags: [
                  { text: 'All A:s', selected: true, values: ['A', 'AA', 'AAA'], valuesText: 'A + AA + AAA' },
                  { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
                  { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
                ],
                options: [
                  { text: 'A', selected: true, value: 'A' },
                  { text: 'AA', selected: true, value: 'AA' },
                  { text: 'AAA', selected: true, value: 'AAA' },
                ],
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                options: [
                  { text: 'A', selected: true, value: 'A' },
                  { text: 'AA', selected: true, value: 'AA' },
                  { text: 'AAA', selected: true, value: 'AAA' },
                ],
                tags: [
                  { text: 'All A:s', selected: true, values: ['A', 'AA', 'AAA'], valuesText: 'A + AA + AAA' },
                  { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
                  { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
                ],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 0', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({}, {}, { highlightIndex: 0 });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, -1);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableHighlightIndex(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                highlightIndex: 0,
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 1', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {},
        {
          highlightIndex: 1,
          options: [
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, -1);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableHighlightIndex(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                highlightIndex: 0,
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is same as options.length', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {},
        {
          highlightIndex: 1,
          options: [
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, 1);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableHighlightIndex(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                highlightIndex: 1,
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is below options.length', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {},
        {
          highlightIndex: 0,
          options: [
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, 1);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableHighlightIndex(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                highlightIndex: 1,
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when toggleAllVariableOptions is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        multi: true,
      });
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleAllVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'A', value: 'A', selected: true },
                  { text: 'B', value: 'B', selected: true },
                ],
                current: { text: 'A + B', value: ['A', 'B'], tags: [] },
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                options: [
                  { text: 'A', value: 'A', selected: true },
                  { text: 'B', value: 'B', selected: true },
                ],
                selectedValues: [
                  { text: 'A', value: 'A', selected: true },
                  { text: 'B', value: 'B', selected: true },
                ],
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableSearchQuery is dispatched and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const searchQuery = 'A';
      const { initialState } = getVariableTestContext(
        {
          query: '__searchFilter',
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        },
        {},
        {
          highlightIndex: 1,
          searchQuery: '',
          options: [],
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, searchQuery);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableSearchQuery(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: true },
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
                current: { text: 'All', value: '$__all', tags: [] },
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                searchQuery: 'A',
                highlightIndex: 0,
                options: [
                  { text: 'All', value: '$__all', selected: true },
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeQueryVariableSearchQuery is dispatched and variable has no searchFilter', () => {
    it('then state should be correct', () => {
      const searchQuery = 'B';
      const { initialState } = getVariableTestContext(
        {
          query: '.*',
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
        },
        {},
        {
          highlightIndex: 1,
          searchQuery: '',
          options: [],
        }
      );
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, searchQuery);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeQueryVariableSearchQuery(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: true },
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
                current: { text: 'All', value: '$__all', tags: [] },
              } as unknown) as VariableModel,
              picker: ({
                ...initialState.variables[0].picker,
                searchQuery: 'B',
                highlightIndex: 0,
                options: [{ text: 'B', value: 'B', selected: false }],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
              } as unknown) as QueryVariablePickerState,
            },
          },
          uuidInEditor: null,
        });
    });
  });
});
