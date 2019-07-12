import React, { PureComponent } from 'react';
import { Select, SelectOptionItem } from '@grafana/ui';
import { dashboardPermissionLevels, DashboardAcl, PermissionLevel } from 'app/types/acl';
import { FolderInfo } from 'app/types';

const setClassNameHelper = (inherited: boolean) => {
  return inherited ? 'gf-form-disabled' : '';
};

function ItemAvatar({ item }: { item: DashboardAcl }) {
  if (item.userAvatarUrl) {
    return <img className="filter-table__avatar" src={item.userAvatarUrl} />;
  }
  if (item.teamAvatarUrl) {
    return <img className="filter-table__avatar" src={item.teamAvatarUrl} />;
  }
  if (item.role === 'Editor') {
    return <i style={{ width: '25px', height: '25px' }} className="gicon gicon-editor" />;
  }

  return <i style={{ width: '25px', height: '25px' }} className="gicon gicon-viewer" />;
}

function ItemDescription({ item }: { item: DashboardAcl }) {
  if (item.userId) {
    return <span className="filter-table__weak-italic">(User)</span>;
  }
  if (item.teamId) {
    return <span className="filter-table__weak-italic">(Team)</span>;
  }
  return <span className="filter-table__weak-italic">(Role)</span>;
}

interface Props {
  item: DashboardAcl;
  onRemoveItem: (item: DashboardAcl) => void;
  onPermissionChanged: (item: DashboardAcl, level: PermissionLevel) => void;
  folderInfo?: FolderInfo;
}

export default class PermissionsListItem extends PureComponent<Props> {
  onPermissionChanged = (option: SelectOptionItem<PermissionLevel>) => {
    this.props.onPermissionChanged(this.props.item, option.value);
  };

  onRemoveItem = () => {
    this.props.onRemoveItem(this.props.item);
  };

  render() {
    const { item, folderInfo } = this.props;
    const inheritedFromRoot = item.dashboardId === -1 && !item.inherited;
    const currentPermissionLevel = dashboardPermissionLevels.find(dp => dp.value === item.permission);

    return (
      <tr className={setClassNameHelper(item.inherited)}>
        <td style={{ width: '1%' }}>
          <ItemAvatar item={item} />
        </td>
        <td style={{ width: '90%' }}>
          {item.name} <ItemDescription item={item} />
        </td>
        <td>
          {item.inherited && folderInfo && (
            <em className="muted no-wrap">
              Inherited from folder{' '}
              <a className="text-link" href={`${folderInfo.url}/permissions`}>
                {folderInfo.title}
              </a>{' '}
            </em>
          )}
          {inheritedFromRoot && <em className="muted no-wrap">Default Permission</em>}
        </td>
        <td className="query-keyword">Can</td>
        <td>
          <div className="gf-form">
            <Select
              isSearchable={false}
              options={dashboardPermissionLevels}
              onChange={this.onPermissionChanged}
              isDisabled={item.inherited}
              className="gf-form-select-box__control--menu-right"
              value={currentPermissionLevel}
            />
          </div>
        </td>
        <td>
          {!item.inherited ? (
            <a className="btn btn-danger btn-small" onClick={this.onRemoveItem}>
              <i className="fa fa-remove" />
            </a>
          ) : (
            <button className="btn btn-inverse btn-small">
              <i className="fa fa-lock" />
            </button>
          )}
        </td>
      </tr>
    );
  }
}
