import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
import { LogMessages, logInfo } from 'app/features/alerting/unified/Analytics';
import { AlertRuleDrawerForm } from 'app/features/alerting/unified/components/AlertRuleDrawerForm';
import { createPanelAlertRuleNavigation } from 'app/features/alerting/unified/utils/navigation';
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

  const { onContinueInAlertingFromDrawer, onButtonClick } = createPanelAlertRuleNavigation(
    () => scenesPanelToRuleFormValues(panel),
    location
  );

  const shouldUseDrawer = config.featureToggles.createAlertRuleFromPanel;

  if (shouldUseDrawer) {
    return (
      <>
        <Button
          icon="bell"
          className={className}
          data-testid="create-alert-rule-button-drawer"
          onClick={() => {
            logInfo(LogMessages.alertRuleFromPanel);
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
