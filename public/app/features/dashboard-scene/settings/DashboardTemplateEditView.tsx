import { PageLayoutType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { getDashboardTemplateSettingsTab } from './enterprise-components/DashboardTemplateSettingsTab';
import { type DashboardEditView, type DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface DashboardTemplateEditViewState extends DashboardEditViewState {}

export class DashboardTemplateEditView
  extends SceneObjectBase<DashboardTemplateEditViewState>
  implements DashboardEditView
{
  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'template';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  static Component = DashboardTemplateEditViewComponent;
}

function DashboardTemplateEditViewComponent({ model }: SceneComponentProps<DashboardTemplateEditView>) {
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
