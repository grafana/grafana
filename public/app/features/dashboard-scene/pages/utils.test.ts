import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import { updateNavModel } from './utils';

describe('utils', () => {
  it('Should update nav model', async () => {
    const reduxStore = configureStore();

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue({
      id: 1,
      uid: 'new-folder',
      title: 'NewFolder',
      url: '',
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      created: '',
      createdBy: '',
      hasAcl: false,
      updated: '',
      updatedBy: '',
    });

    expect(reduxStore.getState().navIndex[`folder-dashboards-new-folder`]).toBeUndefined();

    await updateNavModel('new-folder');

    expect(reduxStore.getState().navIndex[`folder-dashboards-new-folder`]).not.toBeUndefined();
  });
});
