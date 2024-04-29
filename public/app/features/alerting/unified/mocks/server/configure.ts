import server from 'app/features/alerting/unified/mockApi';
import { alertmanagerChoiceHandler } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

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
