import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState } from './reducers';
import { sharedReducer } from './sharedReducer';
import { QueryVariableModel, VariableHide, VariableModel } from '../variable';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, emptyUuid } from './types';
import {
  addVariable,
  changeVariableOrder,
  changeVariableProp,
  duplicateVariable,
  removeInitLock,
  removeVariable,
  resolveInitLock,
  setCurrentVariableValue,
  storeNewVariable,
  toVariablePayload,
} from './actions';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { variableEditorUnMounted } from '../editor/reducer';
import { initialQueryVariableModelState } from '../query/reducer';
import cloneDeep from 'lodash/cloneDeep';
import { Deferred } from '../deferred';
import { getVariableState, getVariableTestContext } from './helpers';
import { changeToEditorEditMode } from './uuidInEditorReducer';
import { VariablesState } from './variablesReducer';

describe('sharedReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model = ({ name: 'name from model', type: 'type from model' } as unknown) as QueryVariableModel;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { global: true, index: 0, model });
      variableAdapters.set('query', createQueryVariableAdapter());
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, { ...initialTemplatingState })
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

  describe('when removeVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = {
        variables: getVariableState(3),
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(removeVariable(payload))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: 'Name-0',
                hide: VariableHide.dontHide,
                index: 0,
                label: 'Label-0',
                skipUrlSync: false,
              },
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: 'Name-2',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-2',
                skipUrlSync: false,
              },
            },
          },
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = {
        variables: getVariableState(3, 1, true),
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(variableEditorUnMounted(payload))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: 'Name-0',
                hide: VariableHide.dontHide,
                index: 0,
                label: 'Label-0',
                skipUrlSync: false,
              },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-1',
                skipUrlSync: false,
              },
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: 'Name-2',
                hide: VariableHide.dontHide,
                index: 2,
                label: 'Label-2',
                skipUrlSync: false,
              },
            },
          },
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched with empty uuid that is already unmounted', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = {
        variables: getVariableState(3, 1, true),
      };

      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      const emptyPayload = toVariablePayload({ uuid: emptyUuid, type: 'query' });

      const expectedState: VariablesState = {
        variables: {
          '0': {
            variable: {
              uuid: '0',
              type: 'query',
              name: 'Name-0',
              hide: VariableHide.dontHide,
              index: 0,
              label: 'Label-0',
              skipUrlSync: false,
            },
          },
          '1': {
            variable: {
              uuid: '1',
              type: 'query',
              name: 'Name-1',
              hide: VariableHide.dontHide,
              index: 1,
              label: 'Label-1',
              skipUrlSync: false,
            },
          },
          '2': {
            variable: {
              uuid: '2',
              type: 'query',
              name: 'Name-2',
              hide: VariableHide.dontHide,
              index: 2,
              label: 'Label-2',
              skipUrlSync: false,
            },
          },
        },
      };

      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(variableEditorUnMounted(payload))
        .thenStateShouldEqual(expectedState)
        .whenActionIsDispatched(variableEditorUnMounted(emptyPayload))
        .thenStateShouldEqual(expectedState);
    });
  });

  describe('when duplicateVariable is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = {
        variables: getVariableState(3),
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { newUuid: '11' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(duplicateVariable(payload))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: 'Name-0',
                hide: VariableHide.dontHide,
                index: 0,
                label: 'Label-0',
                skipUrlSync: false,
              },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-1',
                skipUrlSync: false,
              },
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: 'Name-2',
                hide: VariableHide.dontHide,
                index: 2,
                label: 'Label-2',
                skipUrlSync: false,
              },
            },
            '11': {
              variable: {
                uuid: '11',
                type: 'query',
                name: 'copy_of_Name-1',
                hide: VariableHide.dontHide,
                index: 3,
                label: 'Label-1',
                skipUrlSync: false,
              },
            },
          },
        });
    });
  });

  describe('when changeVariableOrder is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = {
        variables: getVariableState(3),
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { fromIndex: 1, toIndex: 0 });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(changeVariableOrder(payload))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: 'Name-0',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-0',
                skipUrlSync: false,
              },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 0,
                label: 'Label-1',
                skipUrlSync: false,
              },
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: 'Name-2',
                hide: VariableHide.dontHide,
                index: 2,
                label: 'Label-2',
                skipUrlSync: false,
              },
            },
          },
        });
    });
  });

  describe('when storeNewVariable is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = {
        variables: getVariableState(3, -1, true),
      };
      const payload = toVariablePayload({ uuid: '11', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(storeNewVariable(payload))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: 'Name-0',
                hide: VariableHide.dontHide,
                index: 0,
                label: 'Label-0',
                skipUrlSync: false,
              },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-1',
                skipUrlSync: false,
              },
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: 'Name-2',
                hide: VariableHide.dontHide,
                index: 2,
                label: 'Label-2',
                skipUrlSync: false,
              },
            },
            [emptyUuid]: {
              variable: {
                uuid: emptyUuid,
                type: 'query',
                name: `Name-${emptyUuid}`,
                hide: VariableHide.dontHide,
                index: 3,
                label: `Label-${emptyUuid}`,
                skipUrlSync: false,
              },
            },
            [11]: {
              variable: {
                uuid: '11',
                type: 'query',
                name: `Name-${emptyUuid}`,
                hide: VariableHide.dontHide,
                index: 3,
                label: `Label-${emptyUuid}`,
                skipUrlSync: false,
              },
            },
          },
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
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
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
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
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
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
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
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(resolveInitLock(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState.variables[0].variable;
          const expectedState = cloneDeep(initialState);
          delete expectedState.variables[0].variable.initLock;
          expect(resultingRest).toEqual(expectedState.variables[0].variable);
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
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
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
        });
    });
  });

  describe('when changeVariableProp is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const propName = 'useTags';
      const propValue = true;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { propName, propValue });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
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
        });
    });
  });

  describe('when changeToEditorEditMode is dispatched', () => {
    describe('and uuid is emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: VariablesState = {
          variables: getVariableState(3),
        };
        const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
        reducerTester<VariablesState>()
          .givenReducer(sharedReducer, initialState)
          .whenActionIsDispatched(changeToEditorEditMode(payload))
          .thenStateShouldEqual({
            variables: {
              '0': {
                variable: {
                  uuid: '0',
                  type: 'query',
                  name: 'Name-0',
                  hide: VariableHide.dontHide,
                  index: 0,
                  label: 'Label-0',
                  skipUrlSync: false,
                },
              },
              '1': {
                variable: {
                  uuid: '1',
                  type: 'query',
                  name: 'Name-1',
                  hide: VariableHide.dontHide,
                  index: 1,
                  label: 'Label-1',
                  skipUrlSync: false,
                },
              },
              '2': {
                variable: {
                  uuid: '2',
                  type: 'query',
                  name: 'Name-2',
                  hide: VariableHide.dontHide,
                  index: 2,
                  label: 'Label-2',
                  skipUrlSync: false,
                },
              },
              [emptyUuid]: {
                variable: {
                  ...initialQueryVariableModelState,
                  uuid: emptyUuid,
                  type: 'query',
                  name: '',
                  hide: VariableHide.dontHide,
                  index: 3,
                  label: null,
                  skipUrlSync: false,
                },
              },
            },
          });
      });
    });

    describe('and uuid is not emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: VariablesState = {
          variables: getVariableState(3),
        };
        const payload = toVariablePayload({ uuid: '1', type: 'query' });
        reducerTester<VariablesState>()
          .givenReducer(sharedReducer, initialState)
          .whenActionIsDispatched(changeToEditorEditMode(payload))
          .thenStateShouldEqual({
            variables: {
              '0': {
                variable: {
                  uuid: '0',
                  type: 'query',
                  name: 'Name-0',
                  hide: VariableHide.dontHide,
                  index: 0,
                  label: 'Label-0',
                  skipUrlSync: false,
                },
              },
              '1': {
                variable: {
                  uuid: '1',
                  type: 'query',
                  name: 'Name-1',
                  hide: VariableHide.dontHide,
                  index: 1,
                  label: 'Label-1',
                  skipUrlSync: false,
                },
              },
              '2': {
                variable: {
                  uuid: '2',
                  type: 'query',
                  name: 'Name-2',
                  hide: VariableHide.dontHide,
                  index: 2,
                  label: 'Label-2',
                  skipUrlSync: false,
                },
              },
            },
          });
      });
    });
  });
});
