import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from 'react-use';

import { urlUtil } from '@grafana/data';
import { logInfo } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { Alert, Button, LinkButton } from '@grafana/ui';
import { LogMessages } from 'app/features/alerting/unified/Analytics';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

import { DashboardScene } from '../../scene/DashboardScene';

interface ScenesProps {
  panel: VizPanel;
  queryRunner: SceneQueryRunner;
  dashboard: DashboardScene;
  className?: string;
}
export const ScenesNewRuleFromPanelButton = ({ dashboard, queryRunner, panel, className }: ScenesProps) => {
  const location = useLocation();

  const panelState = panel.useState();
  const variables = panelState.$variables?.useState();

  const { loading, value: formValues } = useAsync(
    () => scenesPanelToRuleFormValues(panel, variables?.variables || [], queryRunner, dashboard),
    [panel, dashboard, variables]
  );

  if (loading) {
    return <Button disabled={true}>New alert rule</Button>;
  }

  if (!formValues) {
    return (
      <Alert severity="info" title="No alerting capable query found">
        Cannot create alerts from this panel because no query to an alerting capable datasource is found.
      </Alert>
    );
  }

  const ruleFormUrl = urlUtil.renderUrl('alerting/new', {
    defaults: JSON.stringify(formValues),
    returnTo: location.pathname + location.search,
  });

  return (
    <LinkButton
      icon="bell"
      onClick={() => logInfo(LogMessages.alertRuleFromPanel)}
      href={ruleFormUrl}
      className={className}
      data-testid="create-alert-rule-button"
    >
      New alert rule
    </LinkButton>
  );
};
