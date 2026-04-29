import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ScenesNewRuleFromPanelButton } from '../../../../PanelDataPane/NewAlertRuleButton';
import { useAlertingContext, usePanelContext } from '../../QueryEditorContext';
import { type AlertRule } from '../../types';

import { AlertCard } from './AlertCard';

interface AlertsViewProps {
  alertRules: AlertRule[];
}

export function AlertsView({ alertRules }: AlertsViewProps) {
  const { panel } = usePanelContext();
  const { isDashboardSaved } = useAlertingContext();

  const styles = useStyles2(getStyles);

  if (alertRules.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.buttonWrapper}>
          <ScenesNewRuleFromPanelButton panel={panel} variant="primary" size="sm" disabled={!isDashboardSaved} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {alertRules.map((alert) => (
        <AlertCard key={alert.alertId} alert={alert} />
      ))}
      <div className={styles.buttonWrapper}>
        <ScenesNewRuleFromPanelButton panel={panel} variant="primary" size="sm" />
      </div>
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
  buttonWrapper: css({
    position: 'relative',
    marginInlineStart: theme.spacing(2),
    minHeight: '30px',
  }),
});
