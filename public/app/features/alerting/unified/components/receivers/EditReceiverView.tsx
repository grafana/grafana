import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

export interface EditReceiverViewProps {
  alertmanagerName: string;
  contactPoint: GrafanaManagedContactPoint | Receiver;
  /** When set, called instead of navigating after a successful save. */
  onSaveSuccess?: () => void;
  /** Hides in-form manage-permissions (e.g. embedded instance drawer). */
  hidePermissionsAction?: boolean;
}

export const EditReceiverView = ({
  contactPoint,
  alertmanagerName,
  onSaveSuccess,
  hidePermissionsAction,
  hideCancelButton,
}: EditReceiverViewProps) => {
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);

  const readOnly = !editSupported || !editAllowed;

  if (alertmanagerName === GRAFANA_RULES_SOURCE_NAME) {
    return (
      <GrafanaReceiverForm
        contactPoint={contactPoint}
        readOnly={readOnly}
        editMode
        onSaveSuccess={onSaveSuccess}
        hidePermissionsAction={hidePermissionsAction}
      />
    );
  }
  return (
    <CloudReceiverForm
      alertManagerSourceName={alertmanagerName}
      contactPoint={contactPoint}
      readOnly={readOnly}
      editMode
      onSaveSuccess={onSaveSuccess}
    />
  );
};
