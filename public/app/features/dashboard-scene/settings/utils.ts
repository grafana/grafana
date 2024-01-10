import { useLocation } from 'react-router-dom';

import { locationUtil, NavModelItem } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';

import { AnnotationsEditView } from './AnnotationsEditView';
import { DashboardLinksEditView } from './DashboardLinksEditView';
import { GeneralSettingsEditView } from './GeneralSettingsEditView';
import { VariablesEditView } from './VariablesEditView';
import { VersionsEditView } from './VersionsEditView';

export interface DashboardEditViewState extends SceneObjectState {}

export interface DashboardEditListViewState extends DashboardEditViewState {
  /** Index of the list item to edit */
  editIndex?: number;
}

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
    url: locationUtil.getUrlForPartial(location, { editview: 'settings', editIndex: null }),
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
      {
        text: t('dashboard-settings.links.title', 'Links'),
        url: locationUtil.getUrlForPartial(location, { editview: 'links', editIndex: null }),
        active: currentEditView === 'links',
      },
      {
        text: t('dashboard-settings.versions.title', 'Versions'),
        url: locationUtil.getUrlForPartial(location, { editview: 'versions', editIndex: null }),
        active: currentEditView === 'versions',
      },
    ],
    parentItem: dashboardPageNav,
  };

  return { navModel, pageNav };
}

export function createDashboardEditViewFor(editview: string): DashboardEditView {
  switch (editview) {
    case 'annotations':
      return new AnnotationsEditView({});
    case 'variables':
      return new VariablesEditView({});
    case 'links':
      return new DashboardLinksEditView({});
    case 'versions':
      return new VersionsEditView({});
    case 'settings':
    default:
      return new GeneralSettingsEditView({});
  }
}
