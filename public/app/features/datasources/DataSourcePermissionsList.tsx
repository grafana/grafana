import React, { PureComponent } from 'react';
import { DataSourcePermission } from '../../types';
import { dataSourceAclLevels, DataSourcePermissionLevel } from '../../types/acl';
import DescriptionPicker from '../../core/components/Picker/DescriptionPicker';

interface Props {
  items: DataSourcePermission[];
  onRemoveItem: (item) => void;
}

export class DataSourcePermissionsList extends PureComponent<Props> {
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
              <tr>
                <td style={{ width: '1%' }}>
                  <i style={{ width: '25px', height: '25px' }} className="gicon gicon-shield" />
                </td>
                <td style={{ width: '90%' }}>
                  {}
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
            );
          })}
        </tbody>
      </table>
    );
  }
}

export default DataSourcePermissionsList;
