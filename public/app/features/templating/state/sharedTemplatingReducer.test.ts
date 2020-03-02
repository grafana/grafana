import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TemplatingState } from './reducers';
import { sharedTemplatingReducer } from './sharedTemplatingReducer';
import { VariableHide } from '../variable';
import { emptyUuid, initialVariableEditorState, VariableEditorState, VariableState } from './types';
import {
  changeToEditorEditMode,
  changeToEditorListMode,
  changeVariableHide,
  changeVariableLabel,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  storeNewVariable,
  toVariablePayload,
  updateVariableCompleted,
  updateVariableFailed,
  updateVariableStarting,
  variableEditorMounted,
  variableEditorUnMounted,
} from './actions';
import { DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableEditorState, initialQueryVariableModelState } from '../query/reducer';

const getVariableState = (
  noOfVariables: number,
  inEditorIndex = -1,
  includeEmpty = false
): Record<string, VariableState> => {
  const variables: Record<string, VariableState> = {};

  for (let index = 0; index < noOfVariables; index++) {
    const editor: VariableEditorState =
      index === inEditorIndex
        ? {
            ...initialVariableEditorState,
            type: 'query',
            name: `Name-${index}`,
            isValid: true,
            errors: {},
            dataSources: [],
          }
        : { ...initialVariableEditorState };
    variables[index] = {
      variable: {
        uuid: index.toString(),
        type: 'query',
        name: `Name-${index}`,
        hide: VariableHide.dontHide,
        index,
        label: `Label-${index}`,
        skipUrlSync: false,
      },
      editor,
    };
  }

  if (includeEmpty) {
    variables[emptyUuid] = {
      variable: {
        uuid: emptyUuid,
        type: 'query',
        name: `Name-${emptyUuid}`,
        hide: VariableHide.dontHide,
        index: noOfVariables,
        label: `Label-${emptyUuid}`,
        skipUrlSync: false,
      },
      editor: { ...initialVariableEditorState },
    };
  }

  return variables;
};

describe('sharedTemplatingReducer', () => {
  describe('when removeVariable is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3),
        uuidInEditor: null,
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when variableEditorMounted is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3),
        uuidInEditor: null,
      };
      const datasources: DataSourceSelectItem[] = [
        { name: 'ds1', sort: '', value: 'ds1-value', meta: ({} as unknown) as DataSourcePluginMeta },
        { name: 'ds2', sort: '', value: 'ds2-value', meta: ({} as unknown) as DataSourcePluginMeta },
      ];
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, datasources);
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(variableEditorMounted(payload))
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
              editor: { ...initialVariableEditorState },
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
              editor: {
                ...initialVariableEditorState,
                name: 'Name-1',
                type: 'query',
                dataSources: [
                  { name: 'ds1', sort: '', value: 'ds1-value', meta: ({} as unknown) as DataSourcePluginMeta },
                  { name: 'ds2', sort: '', value: 'ds2-value', meta: ({} as unknown) as DataSourcePluginMeta },
                ],
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
              editor: { ...initialVariableEditorState },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1, true),
        uuidInEditor: '1',
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialQueryVariableEditorState },
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
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when variableEditorUnMounted is dispatched with empty uuid that is already unmounted', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1, true),
        uuidInEditor: '1',
      };

      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      const emptyPayload = toVariablePayload({ uuid: emptyUuid, type: 'query' });

      const expectedState: TemplatingState = {
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
            editor: { ...initialQueryVariableEditorState },
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
          },
        },
        uuidInEditor: null,
      };

      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(variableEditorUnMounted(payload))
        .thenStateShouldEqual(expectedState)
        .whenActionIsDispatched(variableEditorUnMounted(emptyPayload))
        .thenStateShouldEqual(expectedState);
    });
  });

  describe('when changeVariableLabel is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1),
        uuidInEditor: '1',
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, 'New label');
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(changeVariableLabel(payload))
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
              editor: { ...initialVariableEditorState },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.dontHide,
                index: 1,
                label: 'New label',
                skipUrlSync: false,
              },
              editor: { ...initialVariableEditorState, name: 'Name-1' },
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
            },
          },
          uuidInEditor: '1',
        });
    });
  });

  describe('when changeVariableHide is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1),
        uuidInEditor: '1',
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, VariableHide.hideVariable);
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(changeVariableHide(payload))
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
              editor: { ...initialVariableEditorState },
            },
            '1': {
              variable: {
                uuid: '1',
                type: 'query',
                name: 'Name-1',
                hide: VariableHide.hideVariable,
                index: 1,
                label: 'Label-1',
                skipUrlSync: false,
              },
              editor: { ...initialVariableEditorState, name: 'Name-1' },
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
            },
          },
          uuidInEditor: '1',
        });
    });
  });

  describe('when updateVariableStarting is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1),
        uuidInEditor: '1',
      };
      initialState.variables['1'].editor.isValid = false;
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(updateVariableStarting(payload))
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState, name: 'Name-1', isValid: false },
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
            },
          },
          uuidInEditor: '1',
        });
    });
  });

  describe('when updateVariableCompleted is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1),
        uuidInEditor: '1',
      };
      initialState.variables['1'].editor.isValid = false;
      const payload = toVariablePayload({ uuid: '1', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(updateVariableCompleted(payload))
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState, name: 'Name-1', isValid: false },
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
            },
          },
          uuidInEditor: '1',
        });
    });
  });

  describe('when updateVariableFailed is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3, 1),
        uuidInEditor: '1',
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, new Error('Test error'));
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
        .whenActionIsDispatched(updateVariableFailed(payload))
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
              editor: { ...initialVariableEditorState },
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
              editor: {
                ...initialVariableEditorState,
                name: 'Name-1',
                isValid: false,
                errors: { update: 'Test error' },
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
              editor: { ...initialVariableEditorState },
            },
          },
          uuidInEditor: '1',
        });
    });
  });

  describe('when duplicateVariable is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: TemplatingState = {
        variables: getVariableState(3),
        uuidInEditor: null,
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { newUuid: '11' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialQueryVariableEditorState },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeVariableOrder is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: TemplatingState = {
        variables: getVariableState(3),
        uuidInEditor: null,
      };
      const payload = toVariablePayload({ uuid: '1', type: 'query' }, { fromIndex: 1, toIndex: 0 });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState },
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
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when storeNewVariable is dispatched', () => {
    it('then state should be correct', () => {
      variableAdapters.set('query', createQueryVariableAdapter());
      const initialState: TemplatingState = {
        variables: getVariableState(3, -1, true),
        uuidInEditor: null,
      };
      const payload = toVariablePayload({ uuid: '11', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(sharedTemplatingReducer, initialState)
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialVariableEditorState },
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
              editor: { ...initialQueryVariableEditorState },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when changeToEditorEditMode is dispatched', () => {
    describe('and uuid is emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: TemplatingState = {
          variables: getVariableState(3),
          uuidInEditor: null,
        };
        const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
        reducerTester<TemplatingState>()
          .givenReducer(sharedTemplatingReducer, initialState)
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
                editor: { ...initialVariableEditorState },
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
                editor: { ...initialVariableEditorState },
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
                editor: { ...initialQueryVariableEditorState },
              },
            },
            uuidInEditor: emptyUuid,
          });
      });
    });

    describe('and uuid is not emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: TemplatingState = {
          variables: getVariableState(3),
          uuidInEditor: null,
        };
        const payload = toVariablePayload({ uuid: '1', type: 'query' });
        reducerTester<TemplatingState>()
          .givenReducer(sharedTemplatingReducer, initialState)
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
                editor: { ...initialVariableEditorState },
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
                editor: { ...initialVariableEditorState },
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
              },
            },
            uuidInEditor: '1',
          });
      });
    });
  });

  describe('when changeToEditorListMode is dispatched', () => {
    describe('and uuid is emptyUuid', () => {
      it('then state should be correct', () => {
        variableAdapters.set('query', createQueryVariableAdapter());
        const initialState: TemplatingState = {
          variables: getVariableState(3),
          uuidInEditor: emptyUuid,
        };
        const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
        reducerTester<TemplatingState>()
          .givenReducer(sharedTemplatingReducer, initialState)
          .whenActionIsDispatched(changeToEditorListMode(payload))
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
                editor: { ...initialVariableEditorState },
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
                editor: { ...initialVariableEditorState },
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
              },
            },
            uuidInEditor: null,
          });
      });
    });
  });
});
