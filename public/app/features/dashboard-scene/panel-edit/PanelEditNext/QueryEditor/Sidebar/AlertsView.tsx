import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { ActionItem } from '../../Actions';
import { getAlertStateColor, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { AlertRule } from '../types';

import { AlertCard } from './AlertCard';
import { SidebarCard } from './SidebarCard';

interface AlertsViewProps {
  alertRules: AlertRule[];
}

const GHOST_ALERT_ITEM: ActionItem = {
  name: 'New alert rule',
  type: QueryEditorType.Alert,
  isHidden: false,
  alertState: null,
};

export function AlertsView({ alertRules }: AlertsViewProps) {
  const theme = useStyles2((theme) => theme);
  const styles = useStyles2(getStyles);

  if (alertRules.length === 0) {
    return (
      <div className={styles.container}>
        <SidebarCard
          id="ghost-alert"
          isSelected={false}
          item={GHOST_ALERT_ITEM}
          onClick={() => {}} // Noop for the ghost alert
          showAddButton={false}
          variant="ghost"
        >
          <Icon
            name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Alert].icon}
            color={getAlertStateColor(theme, null)}
            size="sm"
          />
        </SidebarCard>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {alertRules.map((alert) => (
        <AlertCard key={alert.alertId} alert={alert} />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginTop: theme.spacing(3),
  }),
});
