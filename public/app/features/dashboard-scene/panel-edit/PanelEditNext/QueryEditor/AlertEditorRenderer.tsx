import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';
import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';

import { ScenesNewRuleFromPanelButton } from '../../PanelDataPane/NewAlertRuleButton';

import { useAlertingContext, usePanelContext, useQueryEditorUIContext } from './QueryEditorContext';
import { EMPTY_ALERT } from './types';

export function AlertEditorRenderer() {
  const { panel } = usePanelContext();
  const { alertRules, isDashboardSaved } = useAlertingContext();
  const { selectedAlert } = useQueryEditorUIContext();

  const rule = useMemo(() => {
    const alertRule = alertRules.find(({ alertId }) => alertId === selectedAlert?.alertId);
    return alertRule?.rule ? [alertRule.rule] : [];
  }, [alertRules, selectedAlert]);

  if (!selectedAlert) {
    return null;
  }

  // Show empty state when viewing alerts with no alerts
  if (selectedAlert.alertId === EMPTY_ALERT.alertId) {
    if (!isDashboardSaved) {
      return (
        <EmptyState
          variant="call-to-action"
          message={t('alerting.panel-alert-tab-content.title-dashboard-not-saved', 'Dashboard not saved')}
        >
          <Trans i18nKey="dashboard.panel-edit.alerting-tab.dashboard-not-saved">
            Dashboard must be saved before alerts can be added.
          </Trans>
        </EmptyState>
      );
    }

    return (
      <EmptyState
        variant="not-found"
        message={t('query-editor-next.alerts.no-alerts', 'No alert rules for this panel')}
        button={<ScenesNewRuleFromPanelButton panel={panel} size="sm" compactAlert />}
      >
        <Trans i18nKey="query-editor-next.alerts.no-alerts-description">
          Create an alert rule to get notified when your data meets certain conditions.
        </Trans>
      </EmptyState>
    );
  }

  return <RulesTable rules={rule} />;
}
