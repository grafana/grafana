import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { toJS } from 'mobx';
import IContainerProps from 'app/containers/IContainerProps';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import Permissions from 'app/core/components/Permissions/Permissions';

@inject('nav', 'folder', 'view', 'permissions')
@observer
export class FolderPermissions extends Component<IContainerProps, any> {
  constructor(props) {
    super(props);
    this.loadStore();
  }

  loadStore() {
    const { nav, folder, view } = this.props;
    return folder.load(view.routeParams.get('slug') as string).then(res => {
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
          <h2 className="page-sub-heading">Folder Permissions</h2>
          <Permissions permissions={permissions} isFolder={true} dashboardId={dashboardId} backendSrv={backendSrv} />
        </div>
      </div>
    );
  }
}
