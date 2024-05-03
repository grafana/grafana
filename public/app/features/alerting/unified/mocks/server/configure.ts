import server from 'app/features/alerting/unified/mockApi';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import { alertmanagerChoiceHandler } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { folderHandler } from 'app/features/alerting/unified/mocks/folders';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO } from 'app/types';

/**
 * Makes the mock server respond in a way that matches the different behaviour associated with
 * Alertmanager choices and the number of configured external alertmanagers
 */
export const setAlertmanagerChoices = (alertmanagersChoice: AlertmanagerChoice, numExternalAlertmanagers: number) => {
  const response = {
    alertmanagersChoice,
    numExternalAlertmanagers,
  };
  server.use(alertmanagerChoiceHandler(response));
};

/**
 * Makes the mock server respond with different folder access control settings
 */
export const setFolderAccessControl = (accessControl: FolderDTO['accessControl']) => {
  server.use(folderHandler(mockFolder({ hasAcl: true, accessControl })));
};
