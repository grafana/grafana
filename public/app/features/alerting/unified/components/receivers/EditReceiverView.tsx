import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { useContactPointAbility } from '../../hooks/abilities/alertmanager/useContactPointAbility';
import { ContactPointAction } from '../../hooks/abilities/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

type Props =
  | { alertmanagerName: typeof GRAFANA_RULES_SOURCE_NAME; contactPoint: GrafanaManagedContactPoint }
  | { alertmanagerName: string; contactPoint: Receiver };

export const EditReceiverView = (props: Props) => {
  // GrafanaManagedContactPoint satisfies EntityToCheck structurally (has metadata?: ObjectMeta).
  // TypeScript cannot narrow a ternary argument through the discriminated-union Props, so a cast
  // is required. For cloud/external AMs the contact point is a plain Receiver (not a k8s entity),
  // so we pass context: undefined to trigger a pure RBAC fallback instead of the k8s annotation check.
  const editAbility = useContactPointAbility({
    action: ContactPointAction.Update,
    context:
      props.alertmanagerName === GRAFANA_RULES_SOURCE_NAME
        ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (props.contactPoint as GrafanaManagedContactPoint)
        : undefined,
  });

  const readOnly = !editAbility.granted;

  if (props.alertmanagerName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm contactPoint={props.contactPoint} readOnly={readOnly} editMode />;
  } else {
    return (
      <CloudReceiverForm
        alertManagerSourceName={props.alertmanagerName}
        contactPoint={props.contactPoint}
        readOnly={readOnly}
        editMode
      />
    );
  }
};
