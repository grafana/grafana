import { toVariablePayload } from './actions';
import { emptyUuid } from './types';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { changeToEditorEditMode, changeToEditorListMode, uuidInEditorReducer } from './uuidInEditorReducer';

describe('uuidInEditorReducer', () => {
  describe('when changeToEditorEditMode is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: string | null = null;
      const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
      reducerTester<string | null>()
        .givenReducer(uuidInEditorReducer, initialState)
        .whenActionIsDispatched(changeToEditorEditMode(payload))
        .thenStateShouldEqual(emptyUuid);
    });
  });

  describe('when changeToEditorListMode is dispatched', () => {
    it('then state should be correct', () => {
      const initialState: string | null = emptyUuid;
      reducerTester<string | null>()
        .givenReducer(uuidInEditorReducer, initialState)
        .whenActionIsDispatched(changeToEditorListMode())
        .thenStateShouldEqual(null);
    });
  });
});

/*
// describe('when changeToEditorEditMode is dispatched', () => {
  //   describe('and uuid is emptyUuid', () => {
  //     it('then state should be correct', () => {
  //       variableAdapters.set('query', createQueryVariableAdapter());
  //       const initialState: TemplatingState = {
  //         variables: getVariableState(3),
  //         uuidInEditor: null,
  //       };
  //       const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
  //       reducerTester<TemplatingState>()
  //         .givenReducer(variablesReducer, initialState)
  //         .whenActionIsDispatched(changeToEditorEditMode(payload))
  //         .thenStateShouldEqual({
  //           variables: {
  //             '0': {
  //               variable: {
  //                 uuid: '0',
  //                 type: 'query',
  //                 name: 'Name-0',
  //                 hide: VariableHide.dontHide,
  //                 index: 0,
  //                 label: 'Label-0',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '1': {
  //               variable: {
  //                 uuid: '1',
  //                 type: 'query',
  //                 name: 'Name-1',
  //                 hide: VariableHide.dontHide,
  //                 index: 1,
  //                 label: 'Label-1',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '2': {
  //               variable: {
  //                 uuid: '2',
  //                 type: 'query',
  //                 name: 'Name-2',
  //                 hide: VariableHide.dontHide,
  //                 index: 2,
  //                 label: 'Label-2',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             [emptyUuid]: {
  //               variable: {
  //                 ...initialQueryVariableModelState,
  //                 uuid: emptyUuid,
  //                 type: 'query',
  //                 name: '',
  //                 hide: VariableHide.dontHide,
  //                 index: 3,
  //                 label: null,
  //                 skipUrlSync: false,
  //               },
  //             },
  //           },
  //           uuidInEditor: emptyUuid,
  //         });
  //     });
  //   });
  //
  //   describe('and uuid is not emptyUuid', () => {
  //     it('then state should be correct', () => {
  //       variableAdapters.set('query', createQueryVariableAdapter());
  //       const initialState: TemplatingState = {
  //         variables: getVariableState(3),
  //         uuidInEditor: null,
  //       };
  //       const payload = toVariablePayload({ uuid: '1', type: 'query' });
  //       reducerTester<TemplatingState>()
  //         .givenReducer(variablesReducer, initialState)
  //         .whenActionIsDispatched(changeToEditorEditMode(payload))
  //         .thenStateShouldEqual({
  //           variables: {
  //             '0': {
  //               variable: {
  //                 uuid: '0',
  //                 type: 'query',
  //                 name: 'Name-0',
  //                 hide: VariableHide.dontHide,
  //                 index: 0,
  //                 label: 'Label-0',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '1': {
  //               variable: {
  //                 uuid: '1',
  //                 type: 'query',
  //                 name: 'Name-1',
  //                 hide: VariableHide.dontHide,
  //                 index: 1,
  //                 label: 'Label-1',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '2': {
  //               variable: {
  //                 uuid: '2',
  //                 type: 'query',
  //                 name: 'Name-2',
  //                 hide: VariableHide.dontHide,
  //                 index: 2,
  //                 label: 'Label-2',
  //                 skipUrlSync: false,
  //               },
  //             },
  //           },
  //           uuidInEditor: '1',
  //         });
  //     });
  //   });
  // });
  //
  // describe('when changeToEditorListMode is dispatched', () => {
  //   describe('and uuid is emptyUuid', () => {
  //     it('then state should be correct', () => {
  //       variableAdapters.set('query', createQueryVariableAdapter());
  //       const initialState: TemplatingState = {
  //         variables: getVariableState(3),
  //         uuidInEditor: emptyUuid,
  //       };
  //       const payload = toVariablePayload({ uuid: emptyUuid, type: 'query' });
  //       reducerTester<TemplatingState>()
  //         .givenReducer(variablesReducer, initialState)
  //         .whenActionIsDispatched(changeToEditorListMode(payload))
  //         .thenStateShouldEqual({
  //           variables: {
  //             '0': {
  //               variable: {
  //                 uuid: '0',
  //                 type: 'query',
  //                 name: 'Name-0',
  //                 hide: VariableHide.dontHide,
  //                 index: 0,
  //                 label: 'Label-0',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '1': {
  //               variable: {
  //                 uuid: '1',
  //                 type: 'query',
  //                 name: 'Name-1',
  //                 hide: VariableHide.dontHide,
  //                 index: 1,
  //                 label: 'Label-1',
  //                 skipUrlSync: false,
  //               },
  //             },
  //             '2': {
  //               variable: {
  //                 uuid: '2',
  //                 type: 'query',
  //                 name: 'Name-2',
  //                 hide: VariableHide.dontHide,
  //                 index: 2,
  //                 label: 'Label-2',
  //                 skipUrlSync: false,
  //               },
  //             },
  //           },
  //           uuidInEditor: null,
  //         });
  //     });
  //   });
  // });
* */
