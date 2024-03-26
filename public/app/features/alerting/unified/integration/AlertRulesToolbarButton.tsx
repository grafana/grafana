import React from 'react';

import { ToolbarButton } from '@grafana/ui';

import { t } from '../../../../core/internationalization';
import { useDashNavModalController } from '../../../dashboard/components/DashNav/DashNav';
import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertRulesDrawer } from './AlertRulesDrawer';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const { showModal, hideModal } = useDashNavModalController();

  const { data: namespaces = [] } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    dashboardUid: dashboardUid,
  });

  if (namespaces.length === 0) {
    return null;
  }

  return (
    <ToolbarButton
      tooltip={t('dashboard.toolbar.alert-rules', 'Alert rules')}
      icon="bell"
      onClick={() => showModal(<AlertRulesDrawer dashboardUid={dashboardUid} onClose={hideModal} />)}
      key="button-alerting"
    />
  );
}
