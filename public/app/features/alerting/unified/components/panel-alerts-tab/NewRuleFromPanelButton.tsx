import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { urlUtil } from '@grafana/data';
import { Alert, Button, LinkButton } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { useSelector } from 'app/types';

import { LogMessages, logInfo } from '../../Analytics';
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
