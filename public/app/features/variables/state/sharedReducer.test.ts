import { cloneDeep } from 'lodash';
import { LoadingState, VariableType } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import {
  addVariable,
  changeVariableOrder,
  changeVariableProp,
  changeVariableType,
  duplicateVariable,
  removeVariable,
  setCurrentVariableValue,
  sharedReducer,
  variableStateCompleted,
  variableStateFailed,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import { ConstantVariableModel, QueryVariableModel, VariableHide, VariableOption } from '../types';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  initialVariablesState,
  toVariablePayload,
  VariableIdentifier,
  VariablesState,
} from './types';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableModelState } from '../query/reducer';
import { getVariableState, getVariableTestContext } from './helpers';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { createConstantVariableAdapter } from '../constant/adapter';
import { initialConstantVariableModelState } from '../constant/reducer';

variableAdapters.setInit(() => [createQueryVariableAdapter(), createConstantVariableAdapter()]);

describe('sharedReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model: any = {
        name: 'name from model',
        type: 'type from model',
        current: undefined,
      };

      const expected: QueryVariableModel = {
        ...initialQueryVariableModelState,
        id: 'name from model',
        global: true,
        index: 0,
        name: 'name from model',
        type: ('type from model' as unknown) as VariableType,
        current: ({} as unknown) as VariableOption,
      };

      const payload = toVariablePayload({ id: 'name from model', type: 'query' }, { global: true, index: 0, model });

      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, { ...initialVariablesState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStateShouldEqual({
          ['name from model']: expected,
        });
    });
  });

  describe('when addVariable is dispatched for a constant model', () => {
    it('then state should be correct', () => {
      const model: any = {
        name: 'constant',
        type: 'constant',
        query: 'a constant',
        current: { selected: true, text: 'A', value: 'A' },
        options: [{ selected: true, text: 'A', value: 'A' }],
      };

      const expected: ConstantVariableModel = {
        ...initialConstantVariableModelState,
        id: 'constant',
        global: true,
        index: 0,
        name: 'constant',
        type: 'constant',
        query: 'a constant',
        current: { selected: true, text: 'a constant', value: 'a constant' },
        options: [{ selected: true, text: 'a constant', value: 'a constant' }],
      };

      const payload = toVariablePayload({ id: 'constant', type: 'constant' }, { global: true, index: 0, model });

      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, { ...initialVariablesState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStateShouldEqual({
          ['constant']: expected,
        });
    });
  });

  describe('when removeVariable is dispatched and reIndex is true', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: true });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(removeVariable(payload))
        .thenStateShouldEqual({
          '0': {
            id: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '2': {
            id: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-2',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
        });
    });
  });

  describe('when removeVariable is dispatched and reIndex is false', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: false });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(removeVariable(payload))
        .thenStateShouldEqual({
          '0': {
            id: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '2': {
            id: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
        });
    });
  });

  describe('when duplicateVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ id: '1', type: 'query' }, { newId: '11' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(duplicateVariable(payload))
        .thenStateShouldEqual({
          '0': {
            id: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '1': {
            id: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-1',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '2': {
            id: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '11': {
            ...initialQueryVariableModelState,
            id: '11',
            name: 'copy_of_Name-1',
            index: 3,
            label: 'Label-1',
          },
        });
    });
  });

  describe('when changeVariableOrder is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ id: '1', type: 'query' }, { fromIndex: 1, toIndex: 0 });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(changeVariableOrder(payload))
        .thenStateShouldEqual({
          '0': {
            id: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-0',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '1': {
            id: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-1',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
          '2': {
            id: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
          },
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.text is an Array with values', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ['A', 'B'], selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { selected: false, text: 'All', value: '$__all' },
              { selected: true, text: 'A', value: 'A' },
              { selected: true, text: 'B', value: 'B' },
            ],
            current: { selected: true, text: ['A', 'B'], value: ['A', 'B'] },
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values except All value', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: 'A + B', selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { selected: false, text: 'All', value: '$__all' },
              { selected: true, text: 'A', value: 'A' },
              { selected: true, text: 'B', value: 'B' },
            ],
            current: { selected: true, text: 'A + B', value: ['A', 'B'] },
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values containing All value', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { selected: true, text: 'All', value: '$__all' },
              { selected: false, text: 'A', value: 'A' },
              { selected: false, text: 'B', value: 'B' },
            ],
            current: { selected: true, text: 'All', value: ['$__all'] },
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when variableStateNotStarted is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        state: LoadingState.Done,
        error: 'Some error',
      });
      const payload = toVariablePayload({ id: '0', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(variableStateNotStarted(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            state: LoadingState.NotStarted,
            error: null,
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when variableStateFetching is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        state: LoadingState.Done,
        error: 'Some error',
      });
      const payload = toVariablePayload({ id: '0', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(variableStateFetching(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            state: LoadingState.Loading,
            error: null,
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when variableStateCompleted is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, {
        state: LoadingState.Loading,
        error: 'Some error',
      });
      const payload = toVariablePayload({ id: '0', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(variableStateCompleted(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            state: LoadingState.Done,
            error: null,
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when variableStateFailed is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter, { state: LoadingState.Loading });
      const payload = toVariablePayload({ id: '0', type: 'query' }, { error: 'Some error' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(variableStateFailed(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            state: LoadingState.Error,
            error: 'Some error',
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when changeVariableProp is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter);
      const propName = 'label';
      const propValue = 'Updated label';
      const payload = toVariablePayload({ id: '0', type: 'query' }, { propName, propValue });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableProp(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': {
            ...initialState[0],
            label: 'Updated label',
          },
        });
    });
  });

  describe('when changeVariableNameSucceeded is dispatched', () => {
    it('then state should be correct', () => {
      const adapter = createQueryVariableAdapter();
      const { initialState } = getVariableTestContext(adapter);
      const newName = 'A new name';
      const payload = toVariablePayload({ id: '0', type: 'query' }, { newName });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableNameSucceeded(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': {
            ...initialState[0],
            name: 'A new name',
          },
        });
    });
  });

  describe('when changeVariableType is dispatched', () => {
    it('then state should be correct', () => {
      const queryAdapter = createQueryVariableAdapter();
      const { initialState: queryAdapterState } = getVariableTestContext(queryAdapter);
      const constantAdapter = createConstantVariableAdapter();
      const { initialState: constantAdapterState } = getVariableTestContext(constantAdapter);
      const newType = 'constant' as VariableType;
      const identifier: VariableIdentifier = { id: '0', type: 'query' };
      const payload = toVariablePayload(identifier, { newType });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(queryAdapterState))
        .whenActionIsDispatched(changeVariableNameSucceeded(toVariablePayload(identifier, { newName: 'test' })))
        .whenActionIsDispatched(
          changeVariableProp(toVariablePayload(identifier, { propName: 'description', propValue: 'new description' }))
        )
        .whenActionIsDispatched(
          changeVariableProp(toVariablePayload(identifier, { propName: 'label', propValue: 'new label' }))
        )
        .whenActionIsDispatched(changeVariableType(payload))
        .thenStateShouldEqual({
          ...constantAdapterState,
          '0': {
            ...constantAdapterState[0],
            name: 'test',
            description: 'new description',
            label: 'new label',
            type: 'constant',
          },
        });
    });
  });
});
