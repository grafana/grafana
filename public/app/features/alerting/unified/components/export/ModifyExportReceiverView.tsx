import { type GrafanaManagedContactPoint } from 'app/plugins/datasource/alertmanager/types';

import { GrafanaExportReceiverForm } from '../receivers/form/GrafanaExportReceiverForm';

interface Props {
  contactPoint: GrafanaManagedContactPoint;
}

export const ModifyExportReceiverView = ({ contactPoint }: Props) => {
  return <GrafanaExportReceiverForm contactPoint={contactPoint} />;
};
