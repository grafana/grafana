import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import {
  initialQueryVariableEditorState,
  initialQueryVariableModelState,
  initialQueryVariablePickerState,
  QueryVariableEditorState,
  QueryVariablePickerState,
  queryVariableReducer,
} from './reducer';
import {
  addVariable,
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  changeVariableProp,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  toVariablePayload,
  updateVariableOptions,
  updateVariableTags,
} from '../state/actions';
import { QueryVariableModel, VariableModel, VariableOption } from '../variable';
import cloneDeep from 'lodash/cloneDeep';
import { Deferred } from '../deferred';
import { DataSourceApi } from '@grafana/data';
import { queryVariableDatasourceLoaded, queryVariableQueryEditorLoaded } from './actions';
import DefaultVariableQueryEditor from '../DefaultVariableQueryEditor';
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
          expect(resultingState.variables[0].editor).toEqual(initialQueryVariableEditorState);
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
    const editor = { ...initialQueryVariableEditorState, ...editorOverrides };
    const picker = { ...initialQueryVariablePickerState, ...pickerOverrides };
    const initialState: TemplatingState = {
      variables: {
        '0': {
          variable,
          editor,
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
          expect(resultingState.variables[0].editor).toEqual(expectedState.variables[0].editor);
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

  describe('when changeVariableNameSucceeded is dispatched and there are other errors', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {
          errors: { name: 'A variable with that name already exists', update: 'Update failed' },
          name: 'Name-0',
        }
      );
      const newName = 'New name';
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, newName);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableNameSucceeded(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                name: 'New name',
              } as unknown) as VariableModel,
              editor: {
                ...initialState.variables[0].editor,
                name: 'New name',
                errors: { update: 'Update failed' },
                isValid: false,
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeVariableNameSucceeded is dispatched and there no other errors', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {
          errors: { name: 'A variable with that name already exists' },
          name: 'Name-0',
          isValid: false,
        }
      );
      const newName = 'New name';
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, newName);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableNameSucceeded(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                name: 'New name',
              } as unknown) as VariableModel,
              editor: {
                ...initialState.variables[0].editor,
                name: 'New name',
                errors: {},
                isValid: true,
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeVariableNameFailed is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext(
        {},
        {
          errors: {},
          name: 'Name-0',
          isValid: true,
        }
      );
      const newName = 'New name';
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { newName, errorText: 'Name already exists' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableNameFailed(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              editor: {
                ...initialState.variables[0].editor,
                name: 'New name',
                errors: { name: 'Name already exists' },
                isValid: false,
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when queryVariableDatasourceLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const dataSource = ({ id: 'mock-data', name: 'MockData' } as unknown) as DataSourceApi;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, dataSource);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(queryVariableDatasourceLoaded(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              editor: ({
                ...initialState.variables[0].editor,
                dataSource,
              } as unknown) as QueryVariableEditorState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when queryVariableQueryEditorLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const VariableQueryEditor = DefaultVariableQueryEditor;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, VariableQueryEditor);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(queryVariableQueryEditorLoaded(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
              } as unknown) as VariableModel,
              editor: ({
                ...initialState.variables[0].editor,
                VariableQueryEditor,
              } as unknown) as QueryVariableEditorState,
            },
          },
          uuidInEditor: null,
        });
    });
  });

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
});
