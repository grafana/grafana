import { FolderDTO, FolderState } from 'app/types/folders';

import { reducerTester } from '../../../../test/core/redux/reducerTester';

import { folderReducer, initialState, loadFolder, setFolderTitle } from './reducers';

function getTestFolder(): FolderDTO {
  return {
    id: 1,
    title: 'test folder',
    uid: 'asd',
    url: 'url',
    canSave: true,
    canEdit: true,
    canAdmin: true,
    canDelete: true,
    version: 0,
    created: '',
    createdBy: '',
    hasAcl: false,
    updated: '',
    updatedBy: '',
  };
}

describe('folder reducer', () => {
  describe('when loadFolder is dispatched', () => {
    it('should load folder and set hasChanged to false', () => {
      reducerTester<FolderState>()
        .givenReducer(folderReducer, { ...initialState, hasChanged: true })
        .whenActionIsDispatched(loadFolder(getTestFolder()))
        .thenStateShouldEqual({
          ...initialState,
          hasChanged: false,
          ...getTestFolder(),
        });
    });
  });

  describe('when setFolderTitle is dispatched', () => {
    describe('and title has length', () => {
      it('then state should be correct', () => {
        reducerTester<FolderState>()
          .givenReducer(folderReducer, { ...initialState })
          .whenActionIsDispatched(setFolderTitle('ready'))
          .thenStateShouldEqual({
            ...initialState,
            hasChanged: true,
            title: 'ready',
          });
      });
    });

    describe('and title has no length', () => {
      it('then state should be correct', () => {
        reducerTester<FolderState>()
          .givenReducer(folderReducer, { ...initialState })
          .whenActionIsDispatched(setFolderTitle(''))
          .thenStateShouldEqual({
            ...initialState,
            hasChanged: false,
            title: '',
          });
      });
    });
  });
});
