import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { GrafanaExportReceiverForm } from '../receivers/form/GrafanaExportReceiverForm';

interface Props {
  contactPoint: GrafanaManagedContactPoint | Receiver;
}

export const ModifyExportReceiverView = ({ contactPoint }: Props) => {
  return <GrafanaExportReceiverForm contactPoint={contactPoint} />;
};
