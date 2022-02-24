import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Tooltip, Icon, Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { StoreState } from 'app/types';
import { DashboardAcl, PermissionLevel, NewDashboardAclItem } from 'app/types/acl';
import {
  getDashboardPermissions,
  addDashboardPermission,
  removeDashboardPermission,
  updateDashboardPermission,
} from '../../state/actions';
import { checkFolderPermissions } from '../../../folders/state/actions';
import { DashboardModel } from '../../state/DashboardModel';
import PermissionList from 'app/core/components/PermissionList/PermissionList';
import AddPermission from 'app/core/components/PermissionList/AddPermission';
import PermissionsInfo from 'app/core/components/PermissionList/PermissionsInfo';

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

export interface OwnProps {
  dashboard: DashboardModel;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

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
    const {
      permissions,
      dashboard: {
        meta: { hasUnsavedFolderChange },
      },
    } = this.props;
    const { isAdding } = this.state;

    return hasUnsavedFolderChange ? (
      <h5>You have changed a folder, please save to view permissions.</h5>
    ) : (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">Permissions</h3>
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
      </div>
    );
  }
}

export const DashboardPermissions = connector(DashboardPermissionsUnconnected);
