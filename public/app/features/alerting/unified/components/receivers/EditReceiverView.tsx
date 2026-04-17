import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { useContactPointAbility } from '../../hooks/abilities/useContactPointAbility';;

import { ContactPointAction } from '../../hooks/abilities/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  alertmanagerName: string;
  contactPoint: GrafanaManagedContactPoint | Receiver;
}

export const EditReceiverView = ({ contactPoint, alertmanagerName }: Props) => {
  const editAbility = useContactPointAbility({ action: ContactPointAction.Update });

  const readOnly = !editAbility.granted;

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
