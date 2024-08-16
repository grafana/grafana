import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  alertManagerSourceName: string;
}

export const NewReceiverView = ({ alertManagerSourceName }: Props) => {
  if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm />;
  } else {
    return <CloudReceiverForm alertManagerSourceName={alertManagerSourceName} />;
  }
};
