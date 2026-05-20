import { Icon, useTheme2 } from '@grafana/ui';

import { getAlertStateColor, QueryEditorType } from '../../../constants';
import { useQueryEditorUIContext, useQueryEditorTypeConfig } from '../../QueryEditorContext';
import { type AlertRule } from '../../types';
import { CardTitle } from '../Cards/CardTitle';
import { SidebarCard } from '../Cards/SidebarCard';

export const AlertCard = ({ alert }: { alert: AlertRule }) => {
  const { highlightedAlert, setHighlightedAlert } = useQueryEditorUIContext();
  const theme = useTheme2();
  const typeConfig = useQueryEditorTypeConfig();
  const isHighlighted = highlightedAlert?.alertId === alert.alertId;

  const item = {
    name: alert.rule.name,
    type: QueryEditorType.Alert,
    isHidden: false,
    alertState: alert.state,
  };

  return (
    <SidebarCard
      id={alert.alertId}
      isHighlighted={isHighlighted}
      item={item}
      onHighlight={() => setHighlightedAlert(alert)}
    >
      <Icon name={typeConfig[QueryEditorType.Alert].icon} color={getAlertStateColor(theme, alert.state)} size="sm" />
      <CardTitle title={alert.rule.name} isHidden={false} />
    </SidebarCard>
  );
};
