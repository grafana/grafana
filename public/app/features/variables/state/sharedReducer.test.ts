import cloneDeep from 'lodash/cloneDeep';
import { default as lodashDefaults } from 'lodash/defaults';
import { LoadingState } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import {
  addVariable,
  changeVariableOrder,
  changeVariableProp,
  duplicateVariable,
  removeVariable,
  setCurrentVariableValue,
  sharedReducer,
  storeNewVariable,
  variableStateCompleted,
  variableStateFailed,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import { QueryVariableModel, VariableHide } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, NEW_VARIABLE_ID, toVariablePayload } from './types';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableModelState } from '../query/reducer';
import { getVariableState, getVariableTestContext } from './helpers';
import { initialVariablesState, VariablesState } from './variablesReducer';
import { changeVariableNameSucceeded } from '../editor/reducer';

variableAdapters.setInit(() => [createQueryVariableAdapter()]);

describe('sharedReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model = ({
        name: 'name from model',
        type: 'type from model',
        current: undefined,
      } as unknown) as QueryVariableModel;

      const payload = toVariablePayload({ id: '0', type: 'query' }, { global: true, index: 0, model });

      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, { ...initialVariablesState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStateShouldEqual({
          [0]: {
            ...lodashDefaults({}, model, initialQueryVariableModelState),
            id: '0',
            global: true,
            index: 0,
          },
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
          },
        });
    });
  });

  describe('when storeNewVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3, -1, true);
      const payload = toVariablePayload({ id: '11', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(storeNewVariable(payload))
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
          },
          [NEW_VARIABLE_ID]: {
            id: NEW_VARIABLE_ID,
            type: 'query',
            name: `Name-${NEW_VARIABLE_ID}`,
            hide: VariableHide.dontHide,
            index: 3,
            label: `Label-${NEW_VARIABLE_ID}`,
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
          },
          [11]: {
            ...initialQueryVariableModelState,
            id: '11',
            name: `Name-${NEW_VARIABLE_ID}`,
            index: 3,
            label: `Label-${NEW_VARIABLE_ID}`,
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
});
