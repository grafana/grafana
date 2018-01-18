import React, { Component } from 'react';
import PermissionsListItem from './PermissionsListItem';
import { observer } from 'mobx-react';

export interface IProps {
  permissions: any[];
  removeItem: any;
  permissionChanged: any;
  fetching: boolean;
}

@observer
class PermissionsList extends Component<IProps, any> {
  render() {
    const { permissions, removeItem, permissionChanged, fetching } = this.props;

    return (
      <table className="filter-table gf-form-group">
        <tbody>
          {permissions.map((item, idx) => {
            return (
              <PermissionsListItem
                key={idx}
                item={item}
                itemIndex={idx}
                removeItem={removeItem}
                permissionChanged={permissionChanged}
              />
            );
          })}
          {/* <tr ng-repeat="acl in ctrl.items" ng-class="{'gf-form-disabled': acl.inherited}">
              <td><!-- 100% -->
                <i className="{{acl.icon}}"></i>
                <span ng-bind-html="acl.nameHtml"></span>
              </td>
              <td>
                <em className="muted no-wrap" ng-show="acl.inherited">Inherited from folder</em>
              </td>
              <td className="query-keyword">Can</td>
              <td>
                <div className="gf-form-select-wrapper">
                  <select className="gf-form-input gf-size-auto"
                    ng-model="acl.permission"
                    ng-options="p.value as p.text for p in ctrl.permissionOptions"
                    ng-change="ctrl.permissionChanged(acl)"
                    ng-disabled="acl.inherited"></select>
                </div>
              </td>
              <td>
                <a className="btn btn-inverse btn-small" ng-click="ctrl.removeItem($index)" ng-hide="acl.inherited">
                  <i className="fa fa-remove"></i>
                </a>
              </td>
            </tr>
            <tr ng-show="ctrl.aclItems.length === 0">
              <td colSpan={4}>
                <em>No permissions are set. Will only be accessible by admins.</em>
              </td>
            </tr> */}
          {fetching === true && permissions.length < 1 ? (
            <tr>
              <td colSpan={4}>
                <em>Loading permissions...</em>
              </td>
            </tr>
          ) : null}

          {fetching === false && permissions.length < 1 ? (
            <tr>
              <td colSpan={4}>
                <em>No permissions are set. Will only be accessible by admins.</em>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  }
}

export default PermissionsList;
