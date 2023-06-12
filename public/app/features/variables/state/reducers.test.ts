import { createAction } from '@reduxjs/toolkit';

import { VariableType } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { VariableAdapter, variableAdapters } from '../adapters';
import { QueryVariableModel } from '../types';
import { toVariablePayload } from '../utils';

import { createQueryVariable } from './__tests__/fixtures';
import { VariablePayload, VariablesState } from './types';
import { cleanVariables, variablesReducer } from './variablesReducer';

const variableAdapter: VariableAdapter<QueryVariableModel> = {
  id: 'mock' as unknown as VariableType,
  name: 'Mock label',
  description: 'Mock description',
  dependsOn: jest.fn(),
  updateOptions: jest.fn(),
  initialState: {} as QueryVariableModel,
  reducer: jest.fn().mockReturnValue({}),
  getValueForUrl: jest.fn(),
  getSaveModel: jest.fn(),
  picker: null as any,
  editor: null as any,
  setValue: jest.fn(),
  setValueFromUrl: jest.fn(),
};

variableAdapters.setInit(() => [{ ...variableAdapter }]);

describe('variablesReducer', () => {
  describe('when cleanUpDashboard is dispatched', () => {
    it('then all variables except global variables should be removed', () => {
      const initialState: VariablesState = {
        '0': createQueryVariable({
          id: '0',
          index: 0,
          name: 'Name-0',
          label: 'Label-0',
        }),

        '1': createQueryVariable({
          id: '1',
          index: 1,
          name: 'Name-1',
          label: 'Label-1',
          global: true,
        }),

        '2': createQueryVariable({
          id: '2',
          index: 2,
          name: 'Name-2',
          label: 'Label-2',
        }),

        '3': createQueryVariable({
          id: '3',
          index: 3,
          name: 'Name-3',
          label: 'Label-3',
          global: true,
        }),
      };

      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(cleanVariables())
        .thenStateShouldEqual({
          '1': initialState['1'],
          '3': initialState['3'],
        });
    });
  });

  describe('when any action is dispatched with a type prop that is registered in variableAdapters', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': createQueryVariable({ id: '0' }),
      };
      variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
      const mockAction = createAction<VariablePayload>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'mock' as unknown as VariableType, id: '0' })))
        .thenStateShouldEqual(initialState);
      expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(1);
      expect(variableAdapters.get('mock').reducer).toHaveBeenCalledWith(
        initialState,
        mockAction(toVariablePayload({ type: 'mock' as unknown as VariableType, id: '0' }))
      );
    });
  });

  describe('when any action is dispatched with a type prop that is not registered in variableAdapters', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': createQueryVariable({ id: '0' }),
      };
      variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
      const mockAction = createAction<VariablePayload>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'adhoc', id: '0' })))
        .thenStateShouldEqual(initialState);
      expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(0);
    });
  });

  describe('when any action is dispatched missing type prop', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: VariablesState = {
        '0': createQueryVariable({ id: '0' }),
      };
      variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
      const mockAction = createAction<string>('mockAction');
      reducerTester<VariablesState>()
        .givenReducer(variablesReducer, initialState)
        .whenActionIsDispatched(mockAction('mocked'))
        .thenStateShouldEqual(initialState);
      expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(0);
    });
  });
});
