import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import React, { FC } from 'react';
import { LinkButton } from '@grafana/ui';
import { panelToRuleFormValues } from '../../utils/rule-form';
import { urlUtil } from '@grafana/data';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export const NewRuleFromPanelButton: FC<Props> = ({ dashboard, panel }) => {
  const formValues = panelToRuleFormValues(panel, dashboard);

  if (!formValues) {
    return null;
  }

  const panelUrl = dashboard.meta.url
    ? urlUtil.renderUrl(dashboard.meta.url, {
        tab: 'alert',
        editPanel: panel.editSourceId,
      })
    : undefined;

  const ruleFormUrl = urlUtil.renderUrl('alerting/new', {
    defaults: JSON.stringify(formValues),
    returnTo: panelUrl,
  });

  return (
    <LinkButton icon="bell" href={ruleFormUrl}>
      Create alert rule from this panel
    </LinkButton>
  );
};
