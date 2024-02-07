import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from 'react-use';

import { urlUtil } from '@grafana/data';
import { locationService, logInfo } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
import { LogMessages } from 'app/features/alerting/unified/Analytics';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

interface ScenesNewRuleFromPanelButtonProps {
  panel: VizPanel;
  className?: string;
}
export const ScenesNewRuleFromPanelButton = ({ panel, className }: ScenesNewRuleFromPanelButtonProps) => {
  const location = useLocation();

  const { loading, value: formValues } = useAsync(() => scenesPanelToRuleFormValues(panel), [panel]);

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

    const updateToDateFormValues = await scenesPanelToRuleFormValues(panel);

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
