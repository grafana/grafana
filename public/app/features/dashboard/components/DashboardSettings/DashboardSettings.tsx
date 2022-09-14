import * as H from 'history';
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil, NavModel, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, PageToolbar } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardModel } from '../../state/DashboardModel';
import { AccessControlDashboardPermissions } from '../DashboardPermissions/AccessControlDashboardPermissions';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
import { SaveDashboardAsButton, SaveDashboardButton } from '../SaveDashboard/SaveDashboardButton';

import { AnnotationsSettings } from './AnnotationsSettings';
import { GeneralSettings } from './GeneralSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';
import { SettingsPage, SettingsPageProps } from './types';

export interface Props {
  dashboard: DashboardModel;
  sectionNav: NavModel;
  pageNav: NavModelItem;
  editview: string;
}

const onClose = () => locationService.partial({ editview: null, editIndex: null });

export function DashboardSettings({ dashboard, editview, pageNav, sectionNav }: Props) {
  const pages = useMemo(() => getSettingsPages(dashboard), [dashboard]);

  const onPostSave = () => {
    dashboard.meta.hasUnsavedFolderChange = false;
  };

  const folderTitle = dashboard.meta.folderTitle;
  const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const canSave = dashboard.meta.canSave;
  const location = useLocation();
  const editIndex = getEditIndex(location);
  const subSectionNav = getSectionNav(pageNav, sectionNav, pages, currentPage, location);
  const size = config.featureToggles.topnav ? 'sm' : 'md';

  const actions = [
    canSaveAs && (
      <SaveDashboardAsButton
        dashboard={dashboard}
        onSaveSuccess={onPostSave}
        variant="secondary"
        key="save as"
        size={size}
      />
    ),
    canSave && <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onPostSave} key="Save" size={size} />,
  ];

  return (
    <>
      {!config.featureToggles.topnav ? (
        <PageToolbar title={`${dashboard.title} / Settings`} parent={folderTitle} onGoBack={onClose}>
          {actions}
        </PageToolbar>
      ) : (
        <AppChromeUpdate actions={actions} />
      )}
      <currentPage.component sectionNav={subSectionNav} dashboard={dashboard} editIndex={editIndex} />
    </>
  );
}

function getSettingsPages(dashboard: DashboardModel) {
  const pages: SettingsPage[] = [];

  if (dashboard.meta.canEdit) {
    pages.push({
      title: 'General',
      id: 'settings',
      icon: 'sliders-v-alt',
      component: GeneralSettings,
    });

    pages.push({
      title: 'Annotations',
      id: 'annotations',
      icon: 'comment-alt',
      component: AnnotationsSettings,
      subTitle:
        'Annotation queries return events that can be visualized as event markers in graphs across the dashboard.',
    });

    pages.push({
      title: 'Variables',
      id: 'templating',
      icon: 'calculator-alt',
      component: VariableEditorContainer,
      subTitle: 'Variables can make your dashboard more dynamic and act as global filters.',
    });

    pages.push({
      title: 'Links',
      id: 'links',
      icon: 'link',
      component: LinksSettings,
    });
  }

  if (dashboard.meta.canMakeEditable) {
    pages.push({
      title: 'General',
      icon: 'sliders-v-alt',
      id: 'settings',
      component: MakeEditable,
    });
  }

  if (dashboard.id && dashboard.meta.canSave) {
    pages.push({
      title: 'Versions',
      id: 'versions',
      icon: 'history',
      component: VersionsSettings,
    });
  }

  if (dashboard.id && dashboard.meta.canAdmin) {
    if (!config.rbacEnabled) {
      pages.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
        component: DashboardPermissions,
      });
    } else if (contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsRead)) {
      pages.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
        component: AccessControlDashboardPermissions,
      });
    }
  }

  pages.push({
    title: 'JSON Model',
    id: 'dashboard_json',
    icon: 'arrow',
    component: JsonEditorSettings,
  });

  return pages;
}

function getSectionNav(
  pageNav: NavModelItem,
  sectionNav: NavModel,
  pages: SettingsPage[],
  currentPage: SettingsPage,
  location: H.Location
): NavModel {
  const main: NavModelItem = {
    text: 'Settings',
    children: [],
    icon: 'apps',
    hideFromBreadcrumbs: true,
  };

  main.children = pages.map((page) => ({
    text: page.title,
    icon: page.icon,
    id: page.id,
    url: locationUtil.getUrlForPartial(location, { editview: page.id, editIndex: null }),
    active: page === currentPage,
    parentItem: main,
    subTitle: page.subTitle,
  }));

  if (pageNav.parentItem) {
    pageNav = {
      ...pageNav,
      parentItem: {
        ...pageNav.parentItem,
        parentItem: sectionNav.node,
      },
    };
  } else {
    pageNav = {
      ...pageNav,
      parentItem: sectionNav.node,
    };
  }

  main.parentItem = pageNav;

  return {
    main,
    node: main.children.find((x) => x.active)!,
  };
}

function MakeEditable({ dashboard }: SettingsPageProps) {
  const onMakeEditable = () => {
    dashboard.editable = true;
    dashboard.meta.canMakeEditable = false;
    dashboard.meta.canEdit = true;
    dashboard.meta.canSave = true;
    // TODO add some kind of reload
  };

  return (
    <div>
      <div className="dashboard-settings__header">Dashboard not editable</div>
      <Button type="submit" onClick={onMakeEditable}>
        Make editable
      </Button>
    </div>
  );
}

function getEditIndex(location: H.Location): number | undefined {
  const editIndex = new URLSearchParams(location.search).get('editIndex');
  if (editIndex != null) {
    return parseInt(editIndex, 10);
  }
  return undefined;
}
