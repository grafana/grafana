import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ContactPointAction } from '../../hooks/abilities/types';
import { useContactPointAbility } from '../../hooks/abilities/useContactPointAbility';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  alertmanagerName: string;
  contactPoint: GrafanaManagedContactPoint | Receiver;
}

export const EditReceiverView = ({ contactPoint, alertmanagerName }: Props) => {
  const editAbility = useContactPointAbility({ action: ContactPointAction.Update, context: {} });

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
