import { useLocation } from 'react-router-dom-v5-compat';

import { locationUtil, NavModelItem } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction, useSelector } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';

import { AnnotationsEditView } from './AnnotationsEditView';
import { DashboardLinksEditView } from './DashboardLinksEditView';
import { GeneralSettingsEditView } from './GeneralSettingsEditView';
import { JsonModelEditView } from './JsonModelEditView';
import { PermissionsEditView } from './PermissionsEditView';
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
    children: [],
    parentItem: dashboardPageNav,
  };

  if (dashboard.state.meta.canEdit) {
    pageNav.children!.push({
      text: t('dashboard-settings.general.title', 'General'),
      url: locationUtil.getUrlForPartial(location, { editview: 'settings', editIndex: null }),
      active: currentEditView === 'settings',
    });
    pageNav.children!.push({
      text: t('dashboard-settings.annotations.title', 'Annotations'),
      url: locationUtil.getUrlForPartial(location, { editview: 'annotations', editIndex: null }),
      active: currentEditView === 'annotations',
    });
    pageNav.children!.push({
      text: t('dashboard-settings.variables.title', 'Variables'),
      url: locationUtil.getUrlForPartial(location, { editview: 'variables', editIndex: null }),
      active: currentEditView === 'variables',
    });
    pageNav.children!.push({
      text: t('dashboard-settings.links.title', 'Links'),
      url: locationUtil.getUrlForPartial(location, { editview: 'links', editIndex: null }),
      active: currentEditView === 'links',
    });
  }

  if (dashboard.state.id && dashboard.state.meta.canSave) {
    pageNav.children!.push({
      text: t('dashboard-settings.versions.title', 'Versions'),
      url: locationUtil.getUrlForPartial(location, { editview: 'versions', editIndex: null }),
      active: currentEditView === 'versions',
    });
  }

  if (dashboard.state.id && dashboard.state.meta.canAdmin) {
    if (contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsRead)) {
      pageNav.children!.push({
        text: t('dashboard-settings.permissions.title', 'Permissions'),
        url: locationUtil.getUrlForPartial(location, { editview: 'permissions', editIndex: null }),
        active: currentEditView === 'permissions',
      });
    }
  }

  pageNav.children!.push({
    text: t('dashboard-settings.json-editor.title', 'JSON Model'),
    url: locationUtil.getUrlForPartial(location, { editview: 'json-model', editIndex: null }),
    active: currentEditView === 'json-model',
  });

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
    case 'json-model':
      return new JsonModelEditView({});
    case 'permissions':
      return new PermissionsEditView({});
    case 'settings':
    default:
      return new GeneralSettingsEditView({});
  }
}
