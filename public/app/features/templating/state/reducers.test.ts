import { templatingReducer, TemplatingState } from './reducers';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cleanUpDashboard } from 'app/features/dashboard/state/reducers';
import { VariableHide, VariableModel } from '../variable';
import { initialVariableEditorState, VariableState } from './types';
import { VariableAdapter, variableAdapters } from '../adapters';
import { createAction } from '@reduxjs/toolkit';
import { toVariablePayload, VariablePayload } from './actions';

describe('templatingReducer', () => {
  describe('when cleanUpDashboard is dispatched', () => {
    it('then all variables except global variables should be removed', () => {
      const initialState: TemplatingState = {
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
            editor: { ...initialVariableEditorState },
            picker: {},
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
              global: true,
            },
            editor: { ...initialVariableEditorState },
            picker: {},
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
            editor: { ...initialVariableEditorState },
            picker: {},
          },
          '3': {
            variable: {
              uuid: '3',
              type: 'query',
              name: 'Name-3',
              hide: VariableHide.dontHide,
              index: 3,
              label: 'Label-3',
              skipUrlSync: false,
              global: true,
            },
            editor: { ...initialVariableEditorState },
            picker: {},
          },
        },
        uuidInEditor: null,
      };

      reducerTester<TemplatingState>()
        .givenReducer(templatingReducer, initialState)
        .whenActionIsDispatched(cleanUpDashboard())
        .thenStateShouldEqual({
          variables: {
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'Label-1',
                skipUrlSync: false,
                global: true,
              },
              editor: { ...initialVariableEditorState },
              picker: {},
            },
            '3': {
              variable: {
                uuid: '3',
                type: 'query',
                name: 'Name-3',
                hide: VariableHide.dontHide,
                index: 3,
                label: 'Label-3',
                skipUrlSync: false,
                global: true,
              },
              editor: { ...initialVariableEditorState },
              picker: {},
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when any action is dispatched with a type prop that is registered in variableAdapters', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: TemplatingState = {
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
            editor: { ...initialVariableEditorState },
            picker: {},
          },
        },
        uuidInEditor: null,
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableState,
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
      reducerTester<TemplatingState>()
        .givenReducer(templatingReducer, initialState)
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
      const initialState: TemplatingState = {
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
            editor: { ...initialVariableEditorState },
            picker: {},
          },
        },
        uuidInEditor: null,
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableState,
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
      reducerTester<TemplatingState>()
        .givenReducer(templatingReducer, initialState)
        .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'adhoc', uuid: '0' })))
        .thenStateShouldEqual(initialState);
      expect(variableAdapter.reducer).toHaveBeenCalledTimes(0);
    });
  });

  describe('when any action is dispatched missing type prop', () => {
    it('then the reducer for that variableAdapter should be invoked', () => {
      const initialState: TemplatingState = {
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
            editor: { ...initialVariableEditorState },
            picker: {},
          },
        },
        uuidInEditor: null,
      };
      const variableAdapter: VariableAdapter<VariableModel> = {
        label: 'Mock label',
        description: 'Mock description',
        dependsOn: jest.fn(),
        updateOptions: jest.fn(),
        initialState: {} as VariableState,
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
      reducerTester<TemplatingState>()
        .givenReducer(templatingReducer, initialState)
        .whenActionIsDispatched(mockAction('mocked'))
        .thenStateShouldEqual(initialState);
      expect(variableAdapter.reducer).toHaveBeenCalledTimes(0);
    });
  });
});
