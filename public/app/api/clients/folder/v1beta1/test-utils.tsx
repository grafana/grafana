import { render } from 'test/test-utils';

import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { useCreateFolder } from './hooks';

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

/** Renders test component with a button that will create a new folder */
export const setupCreateFolder = () => render(<TestCreationComponent />);
