import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import { initialQueryVariableModelState, QueryVariableEditorState, queryVariableReducer } from './reducer';
import {
  addVariable,
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
    editorOverrides: Partial<QueryVariableEditorState> = {}
  ) => {
    const defaultVariable = {
      ...initialQueryVariableModelState,
      uuid: '0',
      index: 0,
      name: '0',
    };
    const variable = { ...defaultVariable, ...variableOverrides };
    const initialState: TemplatingState = {
      variables: {
        '0': {
          variable,
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
