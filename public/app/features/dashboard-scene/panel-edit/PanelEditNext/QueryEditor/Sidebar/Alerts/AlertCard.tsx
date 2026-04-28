import { Icon } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui/themes';

import { getAlertStateColor, QueryEditorType } from '../../../constants';
import { useQueryEditorUIContext, useQueryEditorTypeConfig } from '../../QueryEditorContext';
import { type AlertRule } from '../../types';
import { CardTitle } from '../Cards/CardTitle';
import { SidebarCard } from '../Cards/SidebarCard';

export const AlertCard = ({ alert }: { alert: AlertRule }) => {
  const { selectedAlert, setSelectedAlert } = useQueryEditorUIContext();
  const theme = useTheme2();
  const typeConfig = useQueryEditorTypeConfig();
  const isSelected = selectedAlert?.alertId === alert.alertId;

  const item = {
    name: alert.rule.name,
    type: QueryEditorType.Alert,
    isHidden: false,
    alertState: alert.state,
  };

  return (
    <SidebarCard id={alert.alertId} isSelected={isSelected} item={item} onSelect={() => setSelectedAlert(alert)}>
      <Icon name={typeConfig[QueryEditorType.Alert].icon} color={getAlertStateColor(theme, alert.state)} size="sm" />
      <CardTitle title={alert.rule.name} isHidden={false} />
    </SidebarCard>
  );
};
