import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from 'react-use';

import { urlUtil } from '@grafana/data';
import { locationService, logInfo } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
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

  const { loading, value: formValues } = useAsync(
    () => scenesPanelToRuleFormValues(panel, queryRunner, dashboard),
    [panel, dashboard, queryRunner]
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

  const onClick = async () => {
    logInfo(LogMessages.alertRuleFromPanel);

    const updateToDateFormValues = await scenesPanelToRuleFormValues(panel, queryRunner, dashboard);

    const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
      defaults: JSON.stringify(updateToDateFormValues),
      returnTo: location.pathname + location.search,
    });

    locationService.push(ruleFormUrl);
  };

  return (
    <Button icon="bell" onClick={onClick} className={className} data-testid="create-alert-rule-button">
      New alert rule
    </Button>
  );
};
