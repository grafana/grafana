import { Action, ActionTypes } from './actions';
import { FolderDTO } from 'app/types';
import { inititalState, folderReducer } from './reducers';

function getTestFolder(): FolderDTO {
  return {
    id: 1,
    title: 'test folder',
    uid: 'asd',
    url: 'url',
    canSave: true,
    version: 0,
  };
}

describe('folder reducer', () => {
  it('should load folder and set hasChanged to false', () => {
    const folder = getTestFolder();

    const action: Action = {
      type: ActionTypes.LoadFolder,
      payload: folder,
    };

    const state = folderReducer(inititalState, action);

    expect(state.hasChanged).toEqual(false);
    expect(state.title).toEqual('test folder');
  });

  it('should set title', () => {
    const action: Action = {
      type: ActionTypes.SetFolderTitle,
      payload: 'new title',
    };

    const state = folderReducer(inititalState, action);

    expect(state.hasChanged).toEqual(true);
    expect(state.title).toEqual('new title');
  });
});
