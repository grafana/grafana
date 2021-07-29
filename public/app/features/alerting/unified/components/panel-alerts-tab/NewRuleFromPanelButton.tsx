import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import React, { FC } from 'react';
import { Alert, LinkButton, Button } from '@grafana/ui';
import { panelToRuleFormValues } from '../../utils/rule-form';
import { useLocation } from 'react-router-dom';
import { urlUtil } from '@grafana/data';
import { useAsync } from 'react-use';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  className?: string;
}

export const NewRuleFromPanelButton: FC<Props> = ({ dashboard, panel, className }) => {
  const { loading, value: formValues } = useAsync(() => panelToRuleFormValues(panel, dashboard), [panel, dashboard]);
  const location = useLocation();
  if (loading) {
    return <Button disabled={true}>Create alert rule from this panel</Button>;
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
    <LinkButton icon="bell" href={ruleFormUrl} className={className} data-testid="create-alert-rule-button">
      Create alert rule from this panel
    </LinkButton>
  );
};
