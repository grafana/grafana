import { useContext } from 'react';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { ModalsContext, ToolbarButton } from '@grafana/ui';

import { loadDashboardAlertRuleGroups } from '../../../dashboard-scene/scene/loadPanelAlertStateCandidates';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const { showModal, hideModal } = useContext(ModalsContext);
  const { value: groups = [] } = useAsync(() => loadDashboardAlertRuleGroups(dashboardUid), [dashboardUid]);
  const hasAlertRules = groups.some((group) => group.rules.length > 0);

  if (!hasAlertRules) {
    return null;
  }

  const onShowDrawer = async () => {
    const { AlertRulesDrawer } = await import(/* webpackChunkName: "DashboardAlertingView" */ './AlertRulesDrawer');
    showModal(AlertRulesDrawer, {
      dashboardUid,
      onDismiss: hideModal,
    });
  };

  return (
    <ToolbarButton
      tooltip={t('dashboard.toolbar.alert-rules', 'Alert rules')}
      icon="bell"
      onClick={onShowDrawer}
      key="button-alerting"
    />
  );
}
