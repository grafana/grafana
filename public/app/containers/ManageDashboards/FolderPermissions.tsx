import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import { toJS } from 'mobx';
import IContainerProps from 'app/containers/IContainerProps';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
import AddPermissions from 'app/core/components/Permissions/AddPermissions';
import SlideDown from 'app/core/components/Animations/SlideDown';

@inject('nav', 'folder', 'view', 'permissions')
@observer
export class FolderPermissions extends Component<IContainerProps, any> {
  constructor(props) {
    super(props);
    this.handleAddPermission = this.handleAddPermission.bind(this);
  }

  componentDidMount() {
    this.loadStore();
  }

  componentWillUnmount() {
    const { permissions } = this.props;
    permissions.hideAddPermissions();
  }

  loadStore() {
    const { nav, folder, view } = this.props;
    return folder.load(view.routeParams.get('uid') as string).then(res => {
      view.updatePathAndQuery(`${res.url}/permissions`, {}, {});
      return nav.initFolderNav(toJS(folder.folder), 'manage-folder-permissions');
    });
  }

  handleAddPermission() {
    const { permissions } = this.props;
    permissions.toggleAddPermissions();
  }

  render() {
    const { nav, folder, permissions, backendSrv } = this.props;

    if (!folder.folder || !nav.main) {
      return <h2>Loading</h2>;
    }

    const dashboardId = folder.folder.id;

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <h3 className="page-sub-heading">Folder Permissions</h3>
            <Tooltip className="page-sub-heading-icon" placement="auto" content={PermissionsInfo}>
              <i className="gicon gicon-question gicon--has-hover" />
            </Tooltip>
            <div className="page-action-bar__spacer" />
            <button
              className="btn btn-success pull-right"
              onClick={this.handleAddPermission}
              disabled={permissions.isAddPermissionsVisible}
            >
              <i className="fa fa-plus" /> Add Permission
            </button>
          </div>
          <SlideDown in={permissions.isAddPermissionsVisible}>
            <AddPermissions permissions={permissions} />
          </SlideDown>
          <Permissions permissions={permissions} isFolder={true} dashboardId={dashboardId} backendSrv={backendSrv} />
        </div>
      </div>
    );
  }
}

export default hot(module)(FolderPermissions);
