import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cleanUpDashboard } from 'app/features/dashboard/state/reducers';
import { VariableHide, VariableModel } from '../variable';
import { VariableAdapter, variableAdapters } from '../adapters';
import { createAction } from '@reduxjs/toolkit';
import { variablesReducer, VariablesState } from './variablesReducer';
import { toVariablePayload, VariablePayload } from './types';

describe('variablesReducer', () => {
  describe('when cleanUpDashboard is dispatched', () => {
    it('then all variables except global variables should be removed', () => {
      const initialState: VariablesState = {
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
          global: true,
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
        '3': {
          uuid: '3',
          type: 'query',
          name: 'Name-3',
          hide: VariableHide.dontHide,
          index: 3,
          label: 'Label-3',
          skipUrlSync: false,
          global: true,
        },
      };

      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(cleanUpDashboard())
        .thenStateShouldEqual({
          '1': {
            uuid: '1',
            type: 'query',
            name: 'Name-1',
            hide: VariableHide.dontHide,
            index: 1,
            label: 'Label-1',
            skipUrlSync: false,
            global: true,
          },
          '3': {
            uuid: '3',
            type: 'query',
            name: 'Name-3',
            hide: VariableHide.dontHide,
            index: 3,
            label: 'Label-3',
            skipUrlSync: false,
            global: true,
          },
        });
    });
  });

  describe('when any action is dispatched with a type prop that is registered in variableAdapters', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': {
          uuid: '0',
          type: 'query',
          name: 'Name-0',
          hide: VariableHide.dontHide,
          index: 0,
          label: 'Label-0',
          skipUrlSync: false,
        },
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableModel,
        reducer: jest.fn().mockReturnValue(initialState),
        getValueForUrl: jest.fn(),
        getSaveModel: jest.fn(),
        picker: null as any,
        editor: null as any,
        setValue: jest.fn(),
        setValueFromUrl: jest.fn(),
      };
      variableAdapters.set('query', variableAdapter);
      const mockAction = createAction<VariablePayload>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'query', uuid: '0' })))
        .thenStateShouldEqual(initialState);
      expect(variableAdapter.reducer).toHaveBeenCalledTimes(1);
      expect(variableAdapter.reducer).toHaveBeenCalledWith(
        initialState,
        mockAction(toVariablePayload({ type: 'query', uuid: '0' }))
      );
    });
  });

  describe('when any action is dispatched with a type prop that is not registered in variableAdapters', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': {
          uuid: '0',
          type: 'query',
          name: 'Name-0',
          hide: VariableHide.dontHide,
          index: 0,
          label: 'Label-0',
          skipUrlSync: false,
        },
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableModel,
        reducer: jest.fn().mockReturnValue(initialState),
        getValueForUrl: jest.fn(),
        getSaveModel: jest.fn(),
        picker: null as any,
        editor: null as any,
        setValue: jest.fn(),
        setValueFromUrl: jest.fn(),
      };
      variableAdapters.set('query', variableAdapter);
      const mockAction = createAction<VariablePayload>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'adhoc', uuid: '0' })))
        .thenStateShouldEqual(initialState);
      expect(variableAdapter.reducer).toHaveBeenCalledTimes(0);
    });
  });

  describe('when any action is dispatched missing type prop', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': {
          uuid: '0',
          type: 'query',
          name: 'Name-0',
          hide: VariableHide.dontHide,
          index: 0,
          label: 'Label-0',
          skipUrlSync: false,
        },
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableModel,
        reducer: jest.fn().mockReturnValue(initialState),
        getValueForUrl: jest.fn(),
        getSaveModel: jest.fn(),
        picker: null as any,
        editor: null as any,
        setValue: jest.fn(),
        setValueFromUrl: jest.fn(),
      };
      variableAdapters.set('query', variableAdapter);
      const mockAction = createAction<string>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction('mocked'))
        .thenStateShouldEqual(initialState);
      expect(variableAdapter.reducer).toHaveBeenCalledTimes(0);
    });
  });
});
