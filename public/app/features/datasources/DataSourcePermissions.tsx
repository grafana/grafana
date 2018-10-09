import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from '../../core/components/Animations/SlideDown';
import AddPermissions from '../../core/components/PermissionList/AddPermission';
import { AclTarget, AclTargetInfo } from 'app/types/acl';

export interface Props {}

interface State {
  isAdding: boolean;
}

export class DataSourcePermissions extends PureComponent<Props, State> {
  state = {
    isAdding: false,
  };

  onOpenAddPermissions = () => {
    this.setState({
      isAdding: true,
    });
  };

  onAddPermission = () => {};

  onCancelAddPermission = () => {
    this.setState({
      isAdding: false,
    });
  };

  render() {
    const { isAdding } = this.state;

    const dashboardAclTargets: AclTargetInfo[] = [
      { value: AclTarget.Team, text: 'Team' },
      { value: AclTarget.User, text: 'User' },
    ];

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">Permissions</h3>
          <div className="page-action-bar__spacer" />
          <button className="btn btn-success pull-right" onClick={this.onOpenAddPermissions} disabled={isAdding}>
            <i className="fa fa-plus" /> Add Permission
          </button>
        </div>
        <SlideDown in={isAdding}>
          <AddPermissions
            dashboardAclTargets={dashboardAclTargets}
            showPermissionLevels={false}
            onAddPermission={this.onAddPermission}
            onCancel={this.onCancelAddPermission}
          />
        </SlideDown>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {};
}

export default connect(mapStateToProps)(DataSourcePermissions);
