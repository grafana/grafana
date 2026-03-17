import { useContext } from 'react';

import { t } from '@grafana/i18n';
import { ModalsContext, Sidebar, SidebarContext, ToolbarButton } from '@grafana/ui';

import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertRulesDrawer } from './AlertRulesDrawer';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const { showModal, hideModal } = useContext(ModalsContext);
  const sidebarContext = useContext(SidebarContext);

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

  const tooltip = t('dashboard.toolbar.alert-rules', 'Alert rules');
  const title = t('dashboard.toolbar.alert-rules', 'Alert rules');

  // Use Sidebar.Button when rendered inside the dashboard sidebar for consistent padding and icon size
  if (sidebarContext) {
    return <Sidebar.Button icon="bell" title={title} tooltip={tooltip} onClick={onShowDrawer} key="button-alerting" />;
  }

  return <ToolbarButton tooltip={tooltip} icon="bell" onClick={onShowDrawer} key="button-alerting" />;
}
