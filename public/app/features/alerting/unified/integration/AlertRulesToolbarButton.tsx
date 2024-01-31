import React from 'react';
import { useToggle } from 'react-use';

import { ToolbarButton } from '@grafana/ui';

import { t } from '../../../../core/internationalization';
import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertRulesDrawer } from './AlertRulesDrawer';

interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export default function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const [showDrawer, toggleShowDrawer] = useToggle(false);

  const { data: namespaces = [] } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    dashboardUid: dashboardUid,
  });

  if (namespaces.length === 0) {
    return null;
  }

  return (
    <>
      <ToolbarButton
        tooltip={t('dashboard.toolbar.alert-rules', 'Alert rules')}
        icon="bell"
        onClick={toggleShowDrawer}
        key="button-alerting"
      />
      {showDrawer && <AlertRulesDrawer dashboardUid={dashboardUid} onClose={toggleShowDrawer} />}
    </>
  );
}
