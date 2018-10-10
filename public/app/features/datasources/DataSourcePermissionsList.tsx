import React, { PureComponent } from 'react';
import { DataSourcePermission } from '../../types';
import { dataSourceAclLevels, DataSourcePermissionLevel } from '../../types/acl';
import DescriptionPicker from '../../core/components/Picker/DescriptionPicker';

export interface Props {
  items: DataSourcePermission[];
  onRemoveItem: (item) => void;
}

export class DataSourcePermissionsList extends PureComponent<Props> {
  renderAvatar(item) {
    if (item.teamId) {
      return <img className="filter-table__avatar" src={item.teamAvatarUrl} />;
    } else if (item.userId) {
      return <img className="filter-table__avatar" src={item.userAvatarUrl} />;
    }

    return <i style={{ width: '25px', height: '25px' }} className="gicon gicon-viewer" />;
  }

  renderDescription(item) {
    if (item.userId) {
      return [
        <span key="name">{item.userLogin} </span>,
        <span key="description" className="filter-table__weak-italic">
          (User)
        </span>,
      ];
    }
    if (item.teamId) {
      return [
        <span key="name">{item.team} </span>,
        <span key="description" className="filter-table__weak-italic">
          (Team)
        </span>,
      ];
    }
    return <span className="filter-table__weak-italic">(Role)</span>;
  }

  render() {
    const { items } = this.props;
    const permissionLevels = dataSourceAclLevels;
    permissionLevels.push({ value: DataSourcePermissionLevel.Admin, label: 'Admin', description: '' });

    return (
      <table className="filter-table gf-form-group">
        <tbody>
          <tr className="gf-form-disabled">
            <td style={{ width: '1%' }}>
              <i style={{ width: '25px', height: '25px' }} className="gicon gicon-shield" />
            </td>
            <td style={{ width: '90%' }}>
              Admin
              <span className="filter-table__weak-italic"> (Role)</span>
            </td>
            <td />
            <td className="query-keyword">Can</td>
            <td>
              <div className="gf-form">
                <DescriptionPicker
                  optionsWithDesc={permissionLevels}
                  onSelected={() => {}}
                  value={2}
                  disabled={true}
                  className={'gf-form-input--form-dropdown-right'}
                />
              </div>
            </td>
            <td>
              <button className="btn btn-inverse btn-small">
                <i className="fa fa-lock" />
              </button>
            </td>
          </tr>
          {items.map((item, index) => {
            return (
              <tr key={`${item.id}-${index}`}>
                <td style={{ width: '1%' }}>{this.renderAvatar(item)}</td>
                <td style={{ width: '90%' }}>{this.renderDescription(item)}</td>
                <td />
                <td className="query-keyword">Can</td>
                <td>
                  <div className="gf-form">
                    <DescriptionPicker
                      optionsWithDesc={permissionLevels}
                      onSelected={() => {}}
                      value={1}
                      disabled={true}
                      className={'gf-form-input--form-dropdown-right'}
                    />
                  </div>
                </td>
                <td>
                  <button className="btn btn-danger btn-small" onClick={() => this.props.onRemoveItem(item)}>
                    <i className="fa fa-remove" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

export default DataSourcePermissionsList;
