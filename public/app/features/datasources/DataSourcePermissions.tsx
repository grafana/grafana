import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from '../../core/components/Animations/SlideDown';
import AddDataSourcePermissions from './AddDataSourcePermissions';
import { AclTarget } from 'app/types/acl';
import { addDataSourcePermission, loadDataSourcePermissions, removeDataSourcePermission } from './state/actions';
import { DashboardAcl, DataSourcePermission } from 'app/types';
import { getRouteParamsId } from '../../core/selectors/location';
import PermissionList from '../../core/components/PermissionList/PermissionList';

export interface Props {
  dataSourcePermissions: DataSourcePermission[];
  pageId: number;
  addDataSourcePermission: typeof addDataSourcePermission;
  loadDataSourcePermissions: typeof loadDataSourcePermissions;
  removeDataSourcePermission: typeof removeDataSourcePermission;
}

interface State {
  isAdding: boolean;
}

export class DataSourcePermissions extends PureComponent<Props, State> {
  state = {
    isAdding: false,
  };

  componentDidMount() {
    this.fetchDataSourcePermissions();
  }

  async fetchDataSourcePermissions() {
    const { pageId, loadDataSourcePermissions } = this.props;

    return await loadDataSourcePermissions(pageId);
  }

  onOpenAddPermissions = () => {
    this.setState({
      isAdding: true,
    });
  };

  onAddPermission = state => {
    const { pageId, addDataSourcePermission } = this.props;
    const data = {
      permission: state.permission,
      userId: 0,
      teamId: 0,
    };

    if (state.type === AclTarget.Team) {
      data.teamId = state.teamId;
    } else if (state.team === AclTarget.User) {
      data.userId = state.userId;
    }

    addDataSourcePermission(pageId, data);
  };

  onRemovePermission = (item: DashboardAcl) => {
    this.props.removeDataSourcePermission(1, 1);
  };

  onCancelAddPermission = () => {
    this.setState({
      isAdding: false,
    });
  };

  render() {
    const { dataSourcePermissions } = this.props;
    const { isAdding } = this.state;

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
          <AddDataSourcePermissions
            onAddPermission={state => this.onAddPermission(state)}
            onCancel={this.onCancelAddPermission}
          />
        </SlideDown>
        <PermissionList
          items={dataSourcePermissions}
          onRemoveItem={this.onRemovePermission}
          onPermissionChanged={() => {}}
          isFetching={false}
        />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    pageId: getRouteParamsId(state.location),
    dataSourcePermissions: state.dataSources.dataSourcePermissions,
  };
}

const mapDispatchToProps = {
  addDataSourcePermission,
  loadDataSourcePermissions,
  removeDataSourcePermission,
};

export default connect(mapStateToProps, mapDispatchToProps)(DataSourcePermissions);
