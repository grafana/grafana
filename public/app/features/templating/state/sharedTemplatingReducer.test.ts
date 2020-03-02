import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TemplatingState } from './reducers';
import { sharedTemplatingReducer } from './sharedTemplatingReducer';
import { VariableHide } from '../variable';
import { emptyUuid, VariableState } from './types';
import {
  changeToEditorEditMode,
  changeToEditorListMode,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  storeNewVariable,
  toVariablePayload,
} from './actions';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableModelState } from '../query/reducer';
import { variableEditorUnMounted } from '../editor/reducer';

const getVariableState = (
  noOfVariables: number,
  inEditorIndex = -1,
  includeEmpty = false
): Record<string, VariableState> => {
  const variables: Record<string, VariableState> = {};

  for (let index = 0; index < noOfVariables; index++) {
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
            uuidInEditor: null,
          });
      });
    });
  });
});
