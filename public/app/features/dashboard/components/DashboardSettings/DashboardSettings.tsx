import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { Button, CustomScrollbar, Icon, IconName, PageToolbar, stylesFactory } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { updateLocation } from 'app/core/actions';
import { DashboardModel } from '../../state/DashboardModel';
import { SaveDashboardButton, SaveDashboardAsButton } from '../SaveDashboard/SaveDashboardButton';
import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
import { GeneralSettings } from './GeneralSettings';
import { AnnotationsSettings } from './AnnotationsSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { GrafanaTheme } from '@grafana/data';
export interface Props {
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  editview: string;
}

export interface SettingsPage {
  id: string;
  title: string;
  icon: IconName;
  render: () => React.ReactNode;
}

export class DashboardSettings extends PureComponent<Props> {
  onClose = () => {
    this.props.updateLocation({
      query: { editview: null },
      partial: true,
    });
  };

  onChangePage = (id: string) => {
    this.props.updateLocation({
      query: { editview: id },
      partial: true,
    });
  };

  getPages(): SettingsPage[] {
    const { dashboard } = this.props;
    const pages: SettingsPage[] = [];

    if (dashboard.meta.canEdit) {
      pages.push(this.getGeneralPage());

      pages.push({
        title: 'Annotations',
        id: 'annotations',
        icon: 'comment-alt',
        render: () => <AnnotationsSettings dashboard={dashboard} />,
      });

      pages.push({
        title: 'Variables',
        id: 'templating',
        icon: 'calculator-alt',
        render: () => <VariableEditorContainer />,
      });

      pages.push({
        title: 'Links',
        id: 'links',
        icon: 'link',
        render: () => <LinksSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.meta.canMakeEditable) {
      pages.push({
        title: 'General',
        icon: 'sliders-v-alt',
        id: 'settings',
        render: () => this.renderMakeEditable(),
      });
    }

    if (dashboard.id && dashboard.meta.canSave) {
      pages.push({
        title: 'Versions',
        id: 'versions',
        icon: 'history',
        render: () => <VersionsSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.id && dashboard.meta.canAdmin) {
      pages.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
        render: () => <DashboardPermissions dashboard={dashboard} />,
      });
    }

    pages.push({
      title: 'JSON Model',
      id: 'dashboard_json',
      icon: 'arrow',
      render: () => <JsonEditorSettings dashboard={dashboard} />,
    });

    return pages;
  }

  onMakeEditable = () => {
    const { dashboard } = this.props;
    dashboard.editable = true;
    dashboard.meta.canMakeEditable = false;
    dashboard.meta.canEdit = true;
    dashboard.meta.canSave = true;
    this.forceUpdate();
  };

  onPostSave = () => {
    this.props.dashboard.meta.hasUnsavedFolderChange = false;
    dashboardWatcher.reloadPage();
  };

  renderMakeEditable(): React.ReactNode {
    return (
      <div>
        <div className="dashboard-settings__header">Dashboard not editable</div>
        <Button onClick={this.onMakeEditable}>Make editable</Button>
      </div>
    );
  }

  getGeneralPage(): SettingsPage {
    return {
      title: 'General',
      id: 'settings',
      icon: 'sliders-v-alt',
      render: () => <GeneralSettings dashboard={this.props.dashboard} />,
    };
  }

  render() {
    const { dashboard, editview } = this.props;
    const folderTitle = dashboard.meta.folderTitle;
    const pages = this.getPages();
    const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
    const canSaveAs = contextSrv.hasEditPermissionInFolders;
    const canSave = dashboard.meta.canSave;
    const styles = getStyles(config.theme);

    return (
      <div className="dashboard-settings">
        <PageToolbar title={`${dashboard.title} / Settings`} parent={folderTitle} onGoBack={this.onClose} />
        <CustomScrollbar>
          <div className={styles.scrollInner}>
            <div className={styles.settingsWrapper}>
              <aside className="dashboard-settings__aside">
                {pages.map((page) => (
                  <a
                    className={cx('dashboard-settings__nav-item', { active: page.id === editview })}
                    aria-label={selectors.pages.Dashboard.Settings.General.sectionItems(page.title)}
                    onClick={() => this.onChangePage(page.id)}
                    key={page.id}
                  >
                    <Icon name={page.icon} style={{ marginRight: '4px' }} />
                    {page.title}
                  </a>
                ))}
                <div className="dashboard-settings__aside-actions">
                  {canSave && <SaveDashboardButton dashboard={dashboard} onSaveSuccess={this.onPostSave} />}
                  {canSaveAs && (
                    <SaveDashboardAsButton dashboard={dashboard} onSaveSuccess={this.onPostSave} variant="secondary" />
                  )}
                </div>
              </aside>
              <div className="dashboard-settings__content">{currentPage.render()}</div>
            </div>
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  scrollInner: css`
    min-width: 100%;
    min-height: 100%;
  `,
  settingsWrapper: css`
    background: ${theme.colors.bg1};
    display: flex;
    min-height: 100%;
    width: 100%;
  `,
}));
