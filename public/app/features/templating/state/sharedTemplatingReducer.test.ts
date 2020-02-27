import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TemplatingState } from './index';
import { sharedTemplatingReducer } from './sharedTemplatingReducer';
import { VariableHide } from '../variable';
import { VariableEditorState } from './types';
import { removeVariable, toVariablePayload } from './actions';

describe('sharedTemplatingReducer', () => {
  describe('when removeVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: {
          '0': {
            variable: {
              uuid: '0',
              type: 'query',
              name: '0',
              hide: VariableHide.dontHide,
              index: 0,
              label: null,
              skipUrlSync: false,
            },
            editor: {} as VariableEditorState,
            picker: {},
          },
          '1': {
            variable: {
              uuid: '1',
              type: 'query',
              name: '1',
              hide: VariableHide.dontHide,
              index: 1,
              label: null,
              skipUrlSync: false,
            },
            editor: {} as VariableEditorState,
            picker: {},
          },
          '2': {
            variable: {
              uuid: '2',
              type: 'query',
              name: '2',
              hide: VariableHide.dontHide,
              index: 2,
              label: null,
              skipUrlSync: false,
            },
            editor: {} as VariableEditorState,
            picker: {},
          },
        },
        uuidInEditor: null,
      };
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(removeVariable(toVariablePayload(initialState.variables['1'].variable)))
        .thenStateShouldEqual({
          variables: {
            '0': {
              variable: {
                uuid: '0',
                type: 'query',
                name: '0',
                hide: VariableHide.dontHide,
                index: 0,
                label: null,
                skipUrlSync: false,
              },
              editor: {} as VariableEditorState,
              picker: {},
            },
            '2': {
              variable: {
                uuid: '2',
                type: 'query',
                name: '2',
                hide: VariableHide.dontHide,
                index: 1,
                label: null,
                skipUrlSync: false,
              },
              editor: {} as VariableEditorState,
              picker: {},
            },
          },
          uuidInEditor: null,
        });
    });
  });
});
