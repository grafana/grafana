import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Tooltip, Icon, Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { Page } from 'app/core/components/PageNew/Page';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';
import { StoreState } from 'app/types';
import { DashboardAcl, PermissionLevel, NewDashboardAclItem } from 'app/types/acl';

import { checkFolderPermissions } from '../../../folders/state/actions';
import {
  getDashboardPermissions,
  addDashboardPermission,
  removeDashboardPermission,
  updateDashboardPermission,
} from '../../state/actions';
import { SettingsPageProps } from '../DashboardSettings/types';

const mapStateToProps = (state: StoreState) => ({
  permissions: state.dashboard.permissions,
  canViewFolderPermissions: state.folder.canViewFolderPermissions,
});

const mapDispatchToProps = {
  getDashboardPermissions,
  addDashboardPermission,
  removeDashboardPermission,
  updateDashboardPermission,
  checkFolderPermissions,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = SettingsPageProps & ConnectedProps<typeof connector>;

export interface State {
  isAdding: boolean;
}

export class DashboardPermissionsUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isAdding: false,
    };
  }

  componentDidMount() {
    this.props.getDashboardPermissions(this.props.dashboard.id);
    if (this.props.dashboard.meta.folderUid) {
      this.props.checkFolderPermissions(this.props.dashboard.meta.folderUid);
    }
  }

  onOpenAddPermissions = () => {
    this.setState({ isAdding: true });
  };

  onRemoveItem = (item: DashboardAcl) => {
    this.props.removeDashboardPermission(this.props.dashboard.id, item);
  };

  onPermissionChanged = (item: DashboardAcl, level: PermissionLevel) => {
    this.props.updateDashboardPermission(this.props.dashboard.id, item, level);
  };

  onAddPermission = (newItem: NewDashboardAclItem) => {
    return this.props.addDashboardPermission(this.props.dashboard.id, newItem);
  };

  onCancelAddPermission = () => {
    this.setState({ isAdding: false });
  };

  getFolder() {
    const { dashboard, canViewFolderPermissions } = this.props;

    return {
      id: dashboard.meta.folderId,
      title: dashboard.meta.folderTitle,
      url: dashboard.meta.folderUrl,
      canViewFolderPermissions,
    };
  }

  render() {
    const { permissions, dashboard, sectionNav } = this.props;
    const { isAdding } = this.state;

    if (dashboard.meta.hasUnsavedFolderChange) {
      return (
        <Page navModel={sectionNav}>
          <h5>You have changed a folder, please save to view permissions.</h5>
        </Page>
      );
    }

    return (
      <Page navModel={sectionNav}>
        <div className="page-action-bar">
          <Tooltip placement="auto" content={<PermissionsInfo />}>
            <Icon className="icon--has-hover page-sub-heading-icon" name="question-circle" />
          </Tooltip>
          <div className="page-action-bar__spacer" />
          <Button className="pull-right" onClick={this.onOpenAddPermissions} disabled={isAdding}>
            Add permission
          </Button>
        </div>
        <SlideDown in={isAdding}>
          <AddPermission onAddPermission={this.onAddPermission} onCancel={this.onCancelAddPermission} />
        </SlideDown>
        <PermissionList
          items={permissions}
          onRemoveItem={this.onRemoveItem}
          onPermissionChanged={this.onPermissionChanged}
          isFetching={false}
          folderInfo={this.getFolder()}
        />
      </Page>
    );
  }
}

export const DashboardPermissions = connector(DashboardPermissionsUnconnected);
