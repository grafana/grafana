import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import * as H from 'history';
import React, { useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, locationUtil, NavModel, NavModelItem } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, IconName, PageToolbar, stylesFactory, useForceUpdate } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardModel } from '../../state/DashboardModel';
import { AccessControlDashboardPermissions } from '../DashboardPermissions/AccessControlDashboardPermissions';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
// import { SaveDashboardAsButton, SaveDashboardButton } from '../SaveDashboard/SaveDashboardButton';

import { AnnotationsSettings } from './AnnotationsSettings';
import { GeneralSettings } from './GeneralSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';

export interface Props {
  dashboard: DashboardModel;
  editview: string;
}

export interface SettingsPage {
  id: string;
  title: string;
  icon: IconName;
  component: React.ReactNode;
}

const onClose = () => locationService.partial({ editview: null });

const MakeEditable = (props: { onMakeEditable: () => any }) => (
  <div>
    <div className="dashboard-settings__header">Dashboard not editable</div>
    <Button type="submit" onClick={props.onMakeEditable}>
      Make editable
    </Button>
  </div>
);

export function DashboardSettings({ dashboard, editview }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    {
      isOpen: true,
      onClose,
    },
    ref
  );
  const { dialogProps } = useDialog(
    {
      'aria-label': 'Dashboard settings',
    },
    ref
  );
  const forceUpdate = useForceUpdate();
  const onMakeEditable = useCallback(() => {
    dashboard.editable = true;
    dashboard.meta.canMakeEditable = false;
    dashboard.meta.canEdit = true;
    dashboard.meta.canSave = true;
    forceUpdate();
  }, [dashboard, forceUpdate]);

  const pages = useMemo((): SettingsPage[] => {
    const pages: SettingsPage[] = [];

    if (dashboard.meta.canEdit) {
      pages.push({
        title: 'General',
        id: 'settings',
        icon: 'sliders-v-alt',
        component: <GeneralSettings dashboard={dashboard} />,
      });

      pages.push({
        title: 'Annotations',
        id: 'annotations',
        icon: 'comment-alt',
        component: <AnnotationsSettings dashboard={dashboard} />,
      });

      pages.push({
        title: 'Variables',
        id: 'templating',
        icon: 'calculator-alt',
        component: <VariableEditorContainer dashboard={dashboard} />,
      });

      pages.push({
        title: 'Links',
        id: 'links',
        icon: 'link',
        component: <LinksSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.meta.canMakeEditable) {
      pages.push({
        title: 'General',
        icon: 'sliders-v-alt',
        id: 'settings',
        component: <MakeEditable onMakeEditable={onMakeEditable} />,
      });
    }

    if (dashboard.id && dashboard.meta.canSave) {
      pages.push({
        title: 'Versions',
        id: 'versions',
        icon: 'history',
        component: <VersionsSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.id && dashboard.meta.canAdmin) {
      if (!config.rbacEnabled) {
        pages.push({
          title: 'Permissions',
          id: 'permissions',
          icon: 'lock',
          component: <DashboardPermissions dashboard={dashboard} />,
        });
      } else if (contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsRead)) {
        pages.push({
          title: 'Permissions',
          id: 'permissions',
          icon: 'lock',
          component: <AccessControlDashboardPermissions dashboard={dashboard} />,
        });
      }
    }

    pages.push({
      title: 'JSON Model',
      id: 'dashboard_json',
      icon: 'arrow',
      component: <JsonEditorSettings dashboard={dashboard} />,
    });

    return pages;
  }, [dashboard, onMakeEditable]);

  const onPostSave = () => {
    dashboard.meta.hasUnsavedFolderChange = false;
  };

  const folderTitle = dashboard.meta.folderTitle;
  const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const canSave = dashboard.meta.canSave;
  const location = useLocation();
  const sectionNav = getSectionNav(dashboard, pages, currentPage, location);

  return (
    <>
      {!config.featureToggles.topnav && (
        <PageToolbar title={`${dashboard.title} / Settings`} parent={folderTitle} onGoBack={onClose} />
      )}
      <Page navModel={sectionNav} pageNav={{ text: currentPage.title }}>
        {currentPage.component}
      </Page>
    </>
  );
}

function getSectionNav(
  dashboard: DashboardModel,
  pages: SettingsPage[],
  currentPage: SettingsPage,
  location: H.Location
): NavModel {
  const main: NavModelItem = { text: 'Settings', children: [], icon: 'apps' };

  main.children = pages.map((page) => ({
    text: page.title,
    icon: page.icon,
    id: page.id,
    url: locationUtil.getUrlForPartial(location, { editview: page.id }),
    active: page === currentPage,
  }));

  main.parentItem = {
    text: dashboard.title,
    url: locationUtil.getUrlForPartial(location, { editview: null }),
    parentItem: {
      text: 'Dashboards',
      url: '/dashboards',
    },
  };

  return {
    main,
    node: main,
  };
}
