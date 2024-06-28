import { useContext } from 'react';

import { ModalsContext, ToolbarButton } from '@grafana/ui';

import { t } from '../../../../core/internationalization';
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
    />
  );
}
