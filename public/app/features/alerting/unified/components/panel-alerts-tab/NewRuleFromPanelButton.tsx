import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { useSelector } from 'app/types/store';

import { LogMessages, logInfo } from '../../Analytics';
import { AlertRuleDrawerForm } from '../../components/AlertRuleDrawerForm';
import { createPanelAlertRuleNavigation } from '../../utils/navigation';
import { panelToRuleFormValues } from '../../utils/rule-form';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  className?: string;
}

export const NewRuleFromPanelButton = ({ dashboard, panel, className }: Props) => {
  const templating = useSelector((state) => {
    return state.templating;
  });

  const location = useLocation();

  const { loading, value: formValues } = useAsync(
    () => panelToRuleFormValues(panel, dashboard),
    // Templating variables are required to update formValues on each variable's change. It's used implicitly by the templating engine
    [panel, dashboard, templating]
  );
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <Button disabled={true}>
        <Trans i18nKey="alerting.new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
      </Button>
    );
  }

  if (!formValues) {
    return (
      <Alert
        severity="info"
        title={t(
          'alerting.new-rule-from-panel-button.title-no-alerting-capable-query-found',
          'No alerting capable query found'
        )}
      >
        <Trans i18nKey="alerting.new-rule-from-panel-button.body-no-alerting-capable-query-found">
          Cannot create alerts from this panel because no query to an alerting capable datasource is found.
        </Trans>
      </Alert>
    );
  }

  const { onContinueInAlertingFromDrawer } = createPanelAlertRuleNavigation(
    () => panelToRuleFormValues(panel, dashboard),
    location
  );

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
};
