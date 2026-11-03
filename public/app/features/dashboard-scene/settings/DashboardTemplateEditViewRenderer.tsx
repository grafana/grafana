import { PageLayoutType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';

import { type DashboardTemplateEditView } from './DashboardTemplateEditView';
import { getDashboardTemplateSettingsTab } from './enterprise-components/DashboardTemplateSettingsTab';
import { useDashboardEditPageNav } from './utils';

export function DashboardTemplateEditViewRenderer({ model }: SceneComponentProps<DashboardTemplateEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const { meta } = dashboard.useState();
  const dashboardTemplateUid = meta.dashboardTemplateUid;
  const SettingsForm = getDashboardTemplateSettingsTab();

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <div style={{ maxWidth: '600px' }}>
        {!dashboardTemplateUid ? (
          <Alert
            severity="warning"
            title={t('dashboard-settings.template.unavailable-title', 'Template metadata unavailable')}
          >
            <Trans i18nKey="dashboard-settings.template.unavailable-body">
              This dashboard is not being edited as a template, so template settings cannot be shown.
            </Trans>
          </Alert>
        ) : !SettingsForm ? (
          <Alert
            severity="info"
            title={t('dashboard-settings.template.unavailable-oss-title', 'Available in Grafana Enterprise')}
          >
            <Trans i18nKey="dashboard-settings.template.unavailable-oss-body">
              Editing dashboard template settings requires Grafana Enterprise.
            </Trans>
          </Alert>
        ) : (
          <SettingsForm dashboardTemplateUid={dashboardTemplateUid} />
        )}
      </div>
    </Page>
  );
}
