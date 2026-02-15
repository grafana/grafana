import { Icon, useStyles2 } from '@grafana/ui';

import { getAlertStateColor, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';
import { AlertRule } from '../types';

import { CardTitle } from './CardTitle';
import { SidebarCard } from './SidebarCard';

export const AlertCard = ({ alert }: { alert: AlertRule }) => {
  const { selectedAlert, setSelectedAlert } = useQueryEditorUIContext();
  const theme = useStyles2((theme) => theme);
  const isSelected = selectedAlert?.alertId === alert.alertId;

  const alertName = alert.rule.name;
  const alertState = alert.state;

  const item = {
    name: alertName,
    type: QueryEditorType.Alert,
    isHidden: false,
    alertState,
  };

  return (
    <SidebarCard
      isSelected={isSelected}
      id={alert.alertId}
      item={item}
      onClick={() => setSelectedAlert(alert)}
      showAddButton={false}
    >
      <Icon
        name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Alert].icon}
        color={getAlertStateColor(theme, alertState)}
        size="sm"
      />
      <CardTitle title={alertName} isHidden={false} />
    </SidebarCard>
  );
};
