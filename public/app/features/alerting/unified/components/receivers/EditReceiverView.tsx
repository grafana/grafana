import { GrafanaManagedContactPoint, Receiver } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  alertmanagerName: string;
  contactPoint: GrafanaManagedContactPoint | Receiver;
}

export const EditReceiverView = ({ contactPoint, alertmanagerName }: Props) => {
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);

  const readOnly = !editSupported || !editAllowed;

  if (alertmanagerName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm contactPoint={contactPoint} readOnly={readOnly} editMode />;
  } else {
    return (
      <CloudReceiverForm
        alertManagerSourceName={alertmanagerName}
        contactPoint={contactPoint}
        readOnly={readOnly}
        editMode
      />
    );
  }
};
