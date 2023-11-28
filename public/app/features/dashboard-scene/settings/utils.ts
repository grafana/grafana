import { useLocation } from 'react-router-dom';

import { locationUtil, NavModelItem } from '@grafana/data';
import { SceneObject, SceneObjectRef } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';

import { AnnotationsEditView } from './AnnotationsEditView';
import { GeneralSettingsEditView } from './GeneralSettings';
import { VariablesEditView } from './VariablesEditView';

export interface DashboardEditView extends SceneObject {
  getUrlKey(): string;
}

export function useDashboardEditPageNav(dashboard: DashboardScene, currentEditView: string) {
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const dashboardPageNav = dashboard.getPageNav(location, navIndex);

  const pageNav: NavModelItem = {
    text: 'Settings',
    children: [
      {
        text: t('dashboard-settings.general.title', 'General'),
        url: locationUtil.getUrlForPartial(location, { editview: 'settings', editIndex: null }),
        active: currentEditView === 'settings',
      },
      {
        text: t('dashboard-settings.annotations.title', 'Annotations'),
        url: locationUtil.getUrlForPartial(location, { editview: 'annotations', editIndex: null }),
        active: currentEditView === 'annotations',
      },
      {
        text: t('dashboard-settings.variables.title', 'Variables'),
        url: locationUtil.getUrlForPartial(location, { editview: 'variables', editIndex: null }),
        active: currentEditView === 'variables',
      },
    ],
    parentItem: dashboardPageNav,
  };

  return { navModel, pageNav };
}

export function createDashboardEditViewFor(
  editview: string,
  dashboardRef: SceneObjectRef<DashboardScene>
): DashboardEditView {
  switch (editview) {
    case 'annotations':
      return new AnnotationsEditView({});
    case 'variables':
      return new VariablesEditView({});
    case 'settings':
    default:
      return new GeneralSettingsEditView({ dashboardRef });
  }
}
