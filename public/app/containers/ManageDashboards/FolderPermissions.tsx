import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { toJS } from 'mobx';
import IContainerProps from 'app/containers/IContainerProps';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import Permissions from 'app/core/components/Permissions/Permissions';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import PermissionsInfo from 'app/core/components/Permissions/PermissionsInfo';
@inject('nav', 'folder', 'view', 'permissions')
@observer
export class FolderPermissions extends Component<IContainerProps, any> {
  constructor(props) {
    super(props);
    this.loadStore();
  }

  loadStore() {
    const { nav, folder, view } = this.props;
    return folder.load(view.routeParams.get('uid') as string).then(res => {
      return nav.initFolderNav(toJS(folder.folder), 'manage-folder-permissions');
    });
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
          <div className="page-sub-heading">
            <h2 className="d-inline-block">Folder Permissions</h2>
            <Tooltip className="page-sub-heading-icon" placement="auto" content={PermissionsInfo}>
              <i className="gicon gicon-question gicon--has-hover" />
            </Tooltip>
          </div>

          <Permissions permissions={permissions} isFolder={true} dashboardId={dashboardId} backendSrv={backendSrv} />
        </div>
      </div>
    );
  }
}
