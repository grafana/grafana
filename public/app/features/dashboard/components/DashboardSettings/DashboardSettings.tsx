import React, { PureComponent } from 'react';
import { cx } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { DashboardModel } from '../../state/DashboardModel';
import { BackButton } from 'app/core/components/BackButton/BackButton';
import { updateLocation } from 'app/core/actions';
import { CustomScrollbar, Icon, IconName } from '@grafana/ui';
import { GeneralSettings } from './GeneralSettings';
import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import DashboardPermissions from '../DashboardPermissions/DashboardPermissions';

export interface Props {
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  editview: string;
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

  getFolder() {
    const { dashboard } = this.props;

    return {
      id: dashboard.meta.folderId,
      title: dashboard.meta.folderTitle,
      url: dashboard.meta.folderUrl,
    };
  }

  getPages(): SettingsPage[] {
    const { dashboard } = this.props;
    const pages: SettingsPage[] = [];

    if (dashboard.meta.canEdit) {
      pages.push(this.getGeneralPage());

      pages.push({
        title: 'Annotations',
        id: 'annotations',
        icon: 'comment-alt',
        render: () => <GeneralSettings dashboard={dashboard} />,
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
        render: () => <GeneralSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.id && dashboard.meta.canSave) {
      pages.push({
        title: 'Versions',
        id: 'versions',
        icon: 'history',
        render: () => <GeneralSettings dashboard={dashboard} />,
      });
    }

    if (dashboard.id && dashboard.meta.canAdmin) {
      pages.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
        render: () => <DashboardPermissions dashboardId={dashboard.id} folder={this.getFolder()} />,
      });
    }

    if (dashboard.meta.canMakeEditable) {
      pages.push({
        title: 'General',
        icon: 'sliders-v-alt',
        id: 'make_editable',
        render: () => <GeneralSettings dashboard={dashboard} />,
      });
    }

    pages.push({
      title: 'JSON Model',
      id: 'dashboard_json',
      icon: 'arrow',
      render: () => <GeneralSettings dashboard={dashboard} />,
    });

    return pages;
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
    const haveFolder = (dashboard.meta.folderId ?? 0) > 0;
    const pages = this.getPages();
    const currentPage = pages.find(page => page.id === editview) ?? this.getGeneralPage();

    // Used for side menu buttons
    // this.canSaveAs = contextSrv.hasEditPermissionInFolders;
    // this.canSave = this.dashboard.meta.canSave;
    // this.canDelete = this.dashboard.meta.canSave

    return (
      <div className="dashboard-settings">
        <div className="navbar navbar--edit">
          <div className="navbar-edit">
            <BackButton surface="panel" onClick={this.onClose} />
          </div>
          <div className="navbar-page-btn">
            {haveFolder && <div className="navbar-page-btn__folder">{folderTitle} / </div>}
            <span>{dashboard.title} / Settings</span>
          </div>
        </div>
        <CustomScrollbar>
          <div className="dashboard-settings__body">
            <aside className="dashboard-settings__aside">
              {pages.map(page => (
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
            </aside>
            <div className="dashboard-settings__content">{currentPage.render()}</div>
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

export interface SettingsPage {
  id: string;
  title: string;
  icon: IconName;
  render: () => React.ReactNode;
}
