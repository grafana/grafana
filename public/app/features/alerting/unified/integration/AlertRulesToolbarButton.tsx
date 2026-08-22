import { useContext, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { ModalsContext, ToolbarButton } from '@grafana/ui';

import { loadDashboardAlertRuleGroups } from '../../../dashboard-scene/scene/loadPanelAlertStateCandidates';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const { showModal, hideModal } = useContext(ModalsContext);
  const [hasAlertRules, setHasAlertRules] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadDashboardAlertRuleGroups(dashboardUid)
      .then((groups) => {
        if (!cancelled) {
          setHasAlertRules(groups.some((group) => group.rules.length > 0));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasAlertRules(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardUid]);

  if (!hasAlertRules) {
    return null;
  }

  const onShowDrawer = async () => {
    const { AlertRulesDrawer } = await import(
      /* webpackChunkName: "DashboardAlertingView" */ './AlertRulesDrawer'
    );
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
