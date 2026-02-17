import { Icon, useTheme2 } from '@grafana/ui';

import { getAlertStateColor, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';
import { AlertRule } from '../types';

import { CardTitle } from './CardTitle';
import { SidebarCard } from './SidebarCard';

export const AlertCard = ({ alert }: { alert: AlertRule }) => {
  const { selectedAlert, setSelectedAlert } = useQueryEditorUIContext();
  const theme = useTheme2();
  const isSelected = selectedAlert?.alertId === alert.alertId;

  const item = {
    name: alert.rule.name,
    type: QueryEditorType.Alert,
    isHidden: false,
    alertState: alert.state,
  };

  return (
    <SidebarCard id={alert.alertId} isSelected={isSelected} item={item} onClick={() => setSelectedAlert(alert)}>
      <Icon
        name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Alert].icon}
        color={getAlertStateColor(theme, alert.state)}
        size="sm"
      />
      <CardTitle title={alert.rule.name} isHidden={false} />
    </SidebarCard>
  );
};
