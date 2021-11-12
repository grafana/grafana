import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { Button, CustomScrollbar, Icon, IconName, PageToolbar, stylesFactory, useForceUpdate } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DashboardModel } from '../../state/DashboardModel';
import { SaveDashboardButton, SaveDashboardAsButton } from '../SaveDashboard/SaveDashboardButton';
import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
import { GeneralSettings } from './GeneralSettings';
import { AnnotationsSettings } from './AnnotationsSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { GrafanaTheme2, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

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
    <Button onClick={props.onMakeEditable}>Make editable</Button>
  </div>
);

export function DashboardSettings({ dashboard, editview }: Props) {
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
        component: <VariableEditorContainer />,
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
      pages.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
        component: <DashboardPermissions dashboard={dashboard} />,
      });
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
    dashboardWatcher.reloadPage();
  };

  const folderTitle = dashboard.meta.folderTitle;
  const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const canSave = dashboard.meta.canSave;
  const styles = getStyles(config.theme2);

  return (
    <div className="dashboard-settings">
      <PageToolbar title={`${dashboard.title} / Settings`} parent={folderTitle} onGoBack={onClose} />
      <CustomScrollbar>
        <div className={styles.scrollInner}>
          <div className={styles.settingsWrapper}>
            <aside className="dashboard-settings__aside">
              {pages.map((page) => (
                <Link
                  to={(loc) => locationUtil.updateSearchParams(loc.search, `editview=${page.id}`)}
                  className={cx('dashboard-settings__nav-item', { active: page.id === editview })}
                  key={page.id}
                >
                  <Icon name={page.icon} style={{ marginRight: '4px' }} />
                  {page.title}
                </Link>
              ))}
              <div className="dashboard-settings__aside-actions">
                {canSave && <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onPostSave} />}
                {canSaveAs && (
                  <SaveDashboardAsButton dashboard={dashboard} onSaveSuccess={onPostSave} variant="secondary" />
                )}
              </div>
            </aside>
            <div className={styles.settingsContent}>{currentPage.component}</div>
          </div>
        </div>
      </CustomScrollbar>
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  scrollInner: css`
    min-width: 100%;
    display: flex;
  `,
  settingsWrapper: css`
    margin: ${theme.spacing(0, 2, 2)};
    display: flex;
    flex-grow: 1;
  `,
  settingsContent: css`
    flex-grow: 1;
    height: 100%;
    padding: 32px;
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    border-radius: ${theme.shape.borderRadius()};
  `,
}));
