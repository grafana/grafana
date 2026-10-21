import { type PropsWithChildren, useState } from 'react';
import { type Store } from 'redux';
import { getWrapper, render, screen } from 'test/test-utils';

import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { configureStore } from 'app/store/configureStore';
import { type StoreState } from 'app/types/store';

import { useCreateFolder, useUpdateFolder } from './hooks';

const [_, { folderA }] = getFolderFixtures();

const TestCreationComponent = () => {
  const [createFolder, result] = useCreateFolder();

  return (
    <>
      <AppNotificationList />
      <button onClick={() => createFolder({ title: 'test' })}>Create Folder at root</button>
      <button onClick={() => createFolder({ title: 'test', parentUid: folderA.item.uid })}>
        Create Folder in nested folder
      </button>
      <div>{result.isSuccess ? 'Folder created' : 'Error creating folder'}</div>
    </>
  );
};

const TestUpdateComponent = ({ folderUID }: { folderUID: string }) => {
  const [updateFolder, result] = useUpdateFolder();
  const [title, setTitle] = useState('');

  return (
    <>
      <AppNotificationList />
      <label htmlFor="title">Folder Title</label>
      <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button onClick={() => updateFolder({ title, uid: folderUID })}>Update Folder</button>
      <div>{result.isSuccess ? 'Folder updated' : 'Error updating folder'}</div>
    </>
  );
};

/** Renders test component with a button that will create a new folder */
export const setupCreateFolder = (store = configureStore()) => ({
  ...render(<TestCreationComponent />, { store }),
  store,
});

/** Renders test component with a button that allows updating a folder */
export const setupUpdateFolder = async (folderUID: string, store = configureStore()) => {
  const view = render(<TestUpdateComponent folderUID={folderUID} />, { store });
  await screen.findByText('Update Folder');
  return { ...view, store };
};

/** Wraps `getWrapper` and mounts the toast list so hook tests can assert notifications as the user sees them */
export const getWrapperWithNotifications = (store: Store<StoreState>) => {
  const Wrapper = getWrapper({ store, renderWithRouter: true });
  return function WrapperWithNotifications({ children }: PropsWithChildren) {
    return (
      <Wrapper>
        <AppNotificationList />
        {children}
      </Wrapper>
    );
  };
};
