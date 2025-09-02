import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { useCreateFolder, useGetFolderQueryFacade, useUpdateFolder } from './hooks';

const [_, { folderA }] = getFolderFixtures();

const TestCreationComponent = () => {
  const [createFolder, result] = useCreateFolder();

  return (
    <>
      <AppNotificationList />
      <button onClick={() => createFolder({ title: 'test', parentUid: folderA.item.uid })}>Create Folder</button>
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
      <button onClick={() => updateFolder({ title, uid: folderA.item.uid })}>Update Folder</button>
      <div>{result.isSuccess ? 'Folder updated' : 'Error updating folder'}</div>
    </>
  );
};

/** Renders test component with a button that will create a new folder */
export const setupCreateFolder = () => render(<TestCreationComponent />);

/** Renders test component with a button that will allows updating a folder */
export const setupUpdateFolder = async (folderUID: string) => {
  const view = render(<TestUpdateComponent folderUID={folderUID} />);
  await screen.findByText('Update Folder');
  return view;
};
