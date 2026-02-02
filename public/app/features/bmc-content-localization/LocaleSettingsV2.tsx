import { useMemo } from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../dashboard-scene/scene/DashboardScene';
import { NavToolbarActions } from '../dashboard-scene/scene/NavToolbarActions';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from '../dashboard-scene/settings/utils';
import { getDashboardSceneFor } from '../dashboard-scene/utils/utils';

import { LocaleKeyManagement } from './LocaleKeyManagement';
import { DashboardLocale } from './types';

export interface LocalizationEditViewState extends DashboardEditViewState {}

export class LocaleSettingsV2 extends SceneObjectBase<LocalizationEditViewState> implements DashboardEditView {
  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'localization';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  static Component = ({ model }: SceneComponentProps<LocaleSettingsV2>) => {
    const dashboard = model.getDashboard();
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    const { title } = dashboard.useState();

    const dashboardModelFn = useMemo(() => {
      return {
        title: title,
        getDashLocales: () => {
          return dashboard.getDashLocales();
        },
        updateLocalesChanges: (locales: DashboardLocale) => {
          dashboard.updateLocalesChanges(locales);
        },
      };
    }, [title, dashboard]);

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <LocaleKeyManagement dashboard={dashboardModelFn} globalMode={false} defaultKey="default"></LocaleKeyManagement>
      </Page>
    );
  };
}
