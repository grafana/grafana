import { useContext } from 'react';

import { t } from '@grafana/i18n';
import { ModalsContext, ToolbarButton } from '@grafana/ui';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertRulesDrawer } from './AlertRulesDrawer';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const { showModal, hideModal } = useContext(ModalsContext);

  const { data: namespaces = [] } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    dashboardUid: dashboardUid,
  });

  if (namespaces.length === 0) {
    return null;
  }

  const hasFiringRules = namespaces.some((namespace) =>
    namespace.groups.some((group) =>
      group.rules.some(
        (rule) => rule.type === PromRuleType.Alerting && rule.state === PromAlertingRuleState.Firing
      )
    )
  );

  const onShowDrawer = () => {
    showModal(AlertRulesDrawer, {
      dashboardUid: dashboardUid,
      onDismiss: hideModal,
    });
  };

  return (
    <ToolbarButton
      tooltip={t('dashboard.toolbar.alert-rules', 'Alert rules')}
      icon="bell"
      onClick={onShowDrawer}
      key="button-alerting"
      variant={hasFiringRules ? 'destructive' : 'default'}
    />
  );
}
