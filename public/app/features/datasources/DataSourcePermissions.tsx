import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from '../../core/components/Animations/SlideDown';
import AddDataSourcePermissions from './AddDataSourcePermissions';
import DataSourcePermissionsList from './DataSourcePermissionsList';
import { AclTarget } from 'app/types/acl';
import {
  addDataSourcePermission,
  disableDataSourcePermissions,
  enableDataSourcePermissions,
  loadDataSourcePermissions,
  removeDataSourcePermission,
} from './state/actions';
import { DataSourcePermission } from 'app/types';
import { getRouteParamsId } from '../../core/selectors/location';

export interface Props {
  dataSourcePermission: { enabled: boolean; datasouceId: number; permissions: DataSourcePermission[] };
  pageId: number;
  addDataSourcePermission: typeof addDataSourcePermission;
  enableDataSourcePermissions: typeof enableDataSourcePermissions;
  disableDataSourcePermissions: typeof disableDataSourcePermissions;
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

  onEnablePermissions = () => {
    const { pageId, enableDataSourcePermissions } = this.props;
    enableDataSourcePermissions(pageId);
  };

  onDisablePermissions = () => {
    const { pageId, disableDataSourcePermissions } = this.props;

    disableDataSourcePermissions(pageId);
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
    } else if (state.type === AclTarget.User) {
      data.userId = state.userId;
    }

    addDataSourcePermission(pageId, data);
  };

  onRemovePermission = item => {
    this.props.removeDataSourcePermission(item.datasourceId, item.id);
  };

  onCancelAddPermission = () => {
    this.setState({
      isAdding: false,
    });
  };

  render() {
    const { dataSourcePermission } = this.props;
    const { isAdding } = this.state;
    const isPermissionsEnabled = dataSourcePermission.enabled;

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">Permissions</h3>
          <div className="page-action-bar__spacer" />
          {isPermissionsEnabled && [
            <button
              key="add-permission"
              className="btn btn-success pull-right"
              onClick={this.onOpenAddPermissions}
              disabled={isAdding}
            >
              <i className="fa fa-plus" /> Add Permission
            </button>,
            <button key="disable-permissions" className="btn btn-danger pull-right" onClick={this.onDisablePermissions}>
              Disable Permissions
            </button>,
          ]}
        </div>
        {!isPermissionsEnabled ? (
          <div className="empty-list-cta">
            <div className="empty-list-cta__title">{'Permissions not enabled for this data source.'}</div>
            <button onClick={this.onEnablePermissions} className="empty-list-cta__button btn btn-xlarge btn-success">
              {'Enable'}
            </button>
            <div className="empty-list-cta__pro-tip">
              <i className="fa fa-rocket" /> ProTip:{' '}
              {'Only admins will be able to query the data source after you enable permissions.'}
            </div>
          </div>
        ) : (
          <div>
            <SlideDown in={isAdding}>
              <AddDataSourcePermissions
                onAddPermission={state => this.onAddPermission(state)}
                onCancel={this.onCancelAddPermission}
              />
            </SlideDown>
            <DataSourcePermissionsList
              items={dataSourcePermission.permissions}
              onRemoveItem={item => this.onRemovePermission(item)}
            />
          </div>
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    pageId: getRouteParamsId(state.location),
    dataSourcePermission: state.dataSources.dataSourcePermission,
  };
}

const mapDispatchToProps = {
  addDataSourcePermission,
  enableDataSourcePermissions,
  disableDataSourcePermissions,
  loadDataSourcePermissions,
  removeDataSourcePermission,
};

export default connect(mapStateToProps, mapDispatchToProps)(DataSourcePermissions);
