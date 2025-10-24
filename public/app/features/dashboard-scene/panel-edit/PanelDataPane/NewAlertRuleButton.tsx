import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService, logInfo } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
import { LogMessages } from 'app/features/alerting/unified/Analytics';
import { AlertRuleDrawerForm } from 'app/features/alerting/unified/components/AlertRuleDrawerForm';
import type { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

interface ScenesNewRuleFromPanelButtonProps {
  panel: VizPanel;
  className?: string;
}
export const ScenesNewRuleFromPanelButton = ({ panel, className }: ScenesNewRuleFromPanelButtonProps) => {
  const location = useLocation();

  const { loading, value: formValues } = useAsync(() => scenesPanelToRuleFormValues(panel), [panel]);
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <Button disabled={true}>
        <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
      </Button>
    );
  }

  if (!formValues) {
    return (
      <Alert
        severity="info"
        title={t(
          'dashboard-scene.scenes-new-rule-from-panel-button.title-no-alerting-capable-query-found',
          'No alerting capable query found'
        )}
      >
        <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.body-no-alerting-capable-query-found">
          Cannot create alerts from this panel because no query to an alerting capable datasource is found.
        </Trans>
      </Alert>
    );
  }

  const navigateToAlerting = async (currentValues?: RuleFormValues) => {
    logInfo(LogMessages.alertRuleFromPanel);

    const updateToDateFormValues = currentValues ?? (await scenesPanelToRuleFormValues(panel));

    const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
      defaults: JSON.stringify(updateToDateFormValues),
      returnTo: location.pathname + location.search,
    });

    locationService.push(ruleFormUrl);
  };

  const onContinueInAlertingFromDrawer = (values: RuleFormValues) => {
    void navigateToAlerting(values);
  };

  const onButtonClick = () => {
    void navigateToAlerting(undefined);
  };

  const shouldUseDrawer = config.featureToggles.createAlertRuleFromPanel;

  if (shouldUseDrawer) {
    return (
      <>
        <Button
          icon="bell"
          className={className}
          data-testid="create-alert-rule-button-drawer"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          <Trans i18nKey="alerting.new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
        </Button>
        <AlertRuleDrawerForm
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onContinueInAlerting={onContinueInAlertingFromDrawer}
          prefill={formValues ?? undefined}
        />
      </>
    );
  }

  return (
    <Button icon="bell" onClick={onButtonClick} className={className} data-testid="create-alert-rule-button">
      <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
    </Button>
  );
};
