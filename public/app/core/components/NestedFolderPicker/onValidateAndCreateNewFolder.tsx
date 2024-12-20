import { useState } from 'react';

import { useNewFolderMutation } from '../../../features/browse-dashboards/api/browseDashboardsAPI';
import { validationSrv } from '../../../features/manage-dashboards/services/ValidationSrv';
import { useAppNotification } from '../../copy/appNotification';

export const onValidateAndCreateNewFolder = async (folderName: string): Promise<string | undefined> => {
  const [validFolderName, setValidFolderName] = useState(false);
  const [createNewFolder] = useNewFolderMutation();
  const notifyApp = useAppNotification();

  try {
    await validationSrv.validateNewFolderName(folderName);
    setValidFolderName(true);
  } catch (e) {
    if (e instanceof Error) {
      notifyApp.error(e.message);
    } else {
      notifyApp.error('The folder name is not valid and the folder could not be created.');
    }
  }

  if (validFolderName) {
    try {
      const { data } = await createNewFolder({ title: folderName });
      return data?.uid;
    } catch (e) {
      if (e instanceof Error) {
        notifyApp.error(e.message);
      } else {
        notifyApp.error('The folder could not be created.');
      }
    }
    // TODO: hand over to MoveModal: onCreate({ title: data.title });
  }
};
