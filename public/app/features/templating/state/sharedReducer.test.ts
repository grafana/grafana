import cloneDeep from 'lodash/cloneDeep';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { sharedReducer } from './sharedReducer';
import { QueryVariableModel, VariableHide } from '../variable';
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
import { Deferred } from '../deferred';
import { getVariableState, getVariableTestContext } from './helpers';
import { changeToEditorEditMode } from './uuidInEditorReducer';
import { initialVariablesState, VariablesState } from './variablesReducer';

describe('sharedReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model = ({ name: 'name from model', type: 'type from model' } as unknown) as QueryVariableModel;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { global: true, index: 0, model });
      variableAdapters.set('query', createQueryVariableAdapter());
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, { ...initialVariablesState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState[0];
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
          expect(resultingState[0].initLock!).toBeDefined();
          expect(resultingState[0].initLock!.promise).toBeDefined();
          expect(resultingState[0].initLock!.resolve).toBeDefined();
          expect(resultingState[0].initLock!.reject).toBeDefined();
          return true;
        });
    });
  });

  describe('when removeVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(removeVariable(payload))
        .thenStateShouldEqual({
          '0': {
            uuid: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
          },
          '2': {
            uuid: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-2',
            skipUrlSync: false,
          },
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = getVariableState(3, 1, true);
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(variableEditorUnMounted(payload))
        .thenStateShouldEqual({
          '0': {
            uuid: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
          },
          '1': {
            uuid: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-1',
            skipUrlSync: false,
          },
          '2': {
            uuid: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
          },
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched with empty uuid that is already unmounted', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = getVariableState(3, 1, true);

      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      const emptyPayload = toVariablePayload({ uuid: emptyUuid, type: 'query' });

      const expectedState: VariablesState = {
        '0': {
          uuid: '0',
          type: 'query',
          name: 'Name-0',
          hide: VariableHide.dontHide,
          index: 0,
          label: 'Label-0',
          skipUrlSync: false,
        },
        '1': {
          uuid: '1',
          type: 'query',
          name: 'Name-1',
          hide: VariableHide.dontHide,
          index: 1,
          label: 'Label-1',
          skipUrlSync: false,
        },
        '2': {
          uuid: '2',
          type: 'query',
          name: 'Name-2',
          hide: VariableHide.dontHide,
          index: 2,
          label: 'Label-2',
          skipUrlSync: false,
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
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { newUuid: '11' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(duplicateVariable(payload))
        .thenStateShouldEqual({
          '0': {
            uuid: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
          },
          '1': {
            uuid: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-1',
            skipUrlSync: false,
          },
          '2': {
            uuid: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
          },
          '11': {
            uuid: '11',
            type: 'query',
            name: 'copy_of_Name-1',
            hide: VariableHide.dontHide,
            index: 3,
            label: 'Label-1',
            skipUrlSync: false,
          },
        });
    });
  });

  describe('when changeVariableOrder is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: VariablesState = getVariableState(3);
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { fromIndex: 1, toIndex: 0 });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(changeVariableOrder(payload))
        .thenStateShouldEqual({
          '0': {
            uuid: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-0',
            skipUrlSync: false,
          },
          '1': {
            uuid: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-1',
            skipUrlSync: false,
          },
          '2': {
            uuid: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
          },
        });
    });
  });

  describe('when storeNewVariable is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: VariablesState = getVariableState(3, -1, true);
      const payload = toVariablePayload({ uuid: '11', type: 'query' });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, initialState)
        .whenActionIsDispatched(storeNewVariable(payload))
        .thenStateShouldEqual({
          '0': {
            uuid: '0',
            type: 'query',
            name: 'Name-0',
            hide: VariableHide.dontHide,
            index: 0,
            label: 'Label-0',
            skipUrlSync: false,
          },
          '1': {
            uuid: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-1',
            skipUrlSync: false,
          },
          '2': {
            uuid: '2',
            type: 'query',
            name: 'Name-2',
            hide: VariableHide.dontHide,
            index: 2,
            label: 'Label-2',
            skipUrlSync: false,
          },
          [emptyUuid]: {
            uuid: emptyUuid,
            type: 'query',
            name: `Name-${emptyUuid}`,
            hide: VariableHide.dontHide,
            index: 3,
            label: `Label-${emptyUuid}`,
            skipUrlSync: false,
          },
          [11]: {
            uuid: '11',
            type: 'query',
            name: `Name-${emptyUuid}`,
            hide: VariableHide.dontHide,
            index: 3,
            label: `Label-${emptyUuid}`,
            skipUrlSync: false,
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
          const { initLock, ...resultingRest } = resultingState[0];
          const expectedState = cloneDeep(initialState);
          delete expectedState[0].initLock;
          expect(resultingRest).toEqual(expectedState[0]);
          // make sure that initLock is defined
          expect(resultingState[0].initLock!).toBeDefined();
          expect(resultingState[0].initLock!.promise).toBeDefined();
          expect(resultingState[0].initLock!.resolve).toBeDefined();
          expect(resultingState[0].initLock!.resolve).toHaveBeenCalledTimes(1);
          expect(resultingState[0].initLock!.reject).toBeDefined();
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
          '0': {
            ...initialState[0],
            initLock: null,
          },
        });
    });
  });

  describe('when changeVariableProp is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const propName = 'name';
      const propValue = 'Updated name';
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { propName, propValue });
      reducerTester<VariablesState>()
        .givenReducer(sharedReducer, cloneDeep(initialState))
        .whenActionIsDispatched(changeVariableProp(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': {
            ...initialState[0],
            name: 'Updated name',
          },
        });
    });
  });

  describe('when changeToEditorEditMode is dispatched', () => {
    describe('and uuid is emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: VariablesState = getVariableState(3);
        const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
        reducerTester<VariablesState>()
          .givenReducer(sharedReducer, initialState)
          .whenActionIsDispatched(changeToEditorEditMode(payload))
          .thenStateShouldEqual({
            '0': {
              uuid: '0',
              type: 'query',
              name: 'Name-0',
              hide: VariableHide.dontHide,
              index: 0,
              label: 'Label-0',
              skipUrlSync: false,
            },
            '1': {
              uuid: '1',
              type: 'query',
              name: 'Name-1',
              hide: VariableHide.dontHide,
              index: 1,
              label: 'Label-1',
              skipUrlSync: false,
            },
            '2': {
              uuid: '2',
              type: 'query',
              name: 'Name-2',
              hide: VariableHide.dontHide,
              index: 2,
              label: 'Label-2',
              skipUrlSync: false,
            },
            [emptyUuid]: {
              ...initialQueryVariableModelState,
              uuid: emptyUuid,
              type: 'query',
              name: '',
              hide: VariableHide.dontHide,
              index: 3,
              label: null,
              skipUrlSync: false,
            },
          });
      });
    });

    describe('and uuid is not emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: VariablesState = getVariableState(3);
        const payload = toVariablePayload({ uuid: '1', type: 'query' });
        reducerTester<VariablesState>()
          .givenReducer(sharedReducer, initialState)
          .whenActionIsDispatched(changeToEditorEditMode(payload))
          .thenStateShouldEqual({
            '0': {
              uuid: '0',
              type: 'query',
              name: 'Name-0',
              hide: VariableHide.dontHide,
              index: 0,
              label: 'Label-0',
              skipUrlSync: false,
            },
            '1': {
              uuid: '1',
              type: 'query',
              name: 'Name-1',
              hide: VariableHide.dontHide,
              index: 1,
              label: 'Label-1',
              skipUrlSync: false,
            },
            '2': {
              uuid: '2',
              type: 'query',
              name: 'Name-2',
              hide: VariableHide.dontHide,
              index: 2,
              label: 'Label-2',
              skipUrlSync: false,
            },
          });
      });
    });
  });
});
