import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import {
  initialQueryVariableEditorState,
  initialQueryVariableModelState,
  initialQueryVariablePickerState,
  queryVariableReducer,
} from './reducer';
import { addVariable, toVariablePayload, updateVariableOptions } from '../state/actions';
import { QueryVariableModel, VariableModel, VariableOption } from '../variable';

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
          expect(resultingState.variables[0].variable?.initLock).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.promise).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.resolve).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.reject).toBeDefined();
          return true;
        });
    });
  });

  const getUpdateVariableOptionsContext = (variableOverrides: Partial<QueryVariableModel> = {}) => {
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
          editor: { ...initialQueryVariableEditorState },
          picker: { ...initialQueryVariablePickerState },
        },
      },
      uuidInEditor: null,
    };

    return { initialState };
  };

  describe('when updateVariableOptions is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: true });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: false });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: true });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: false });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: true, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
      const { initialState } = getUpdateVariableOptionsContext({ includeAll: false, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialState })
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
});
