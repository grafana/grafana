import React, { Component } from 'react';
import { Select } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';

export interface Props {
  item: any;
}

export default class DisabledPermissionListItem extends Component<Props, any> {
  render() {
    const { item } = this.props;
    const currentPermissionLevel = dashboardPermissionLevels.find(dp => dp.value === item.permission);

    return (
      <tr className="gf-form-disabled">
        <td style={{ width: '1%' }}>
          <i style={{ width: '25px', height: '25px' }} className="gicon gicon-shield" />
        </td>
        <td style={{ width: '90%' }}>
          {item.name}
          <span className="filter-table__weak-italic"> (Role)</span>
        </td>
        <td />
        <td className="query-keyword">Can</td>
        <td>
          <div className="gf-form">
            <Select
              options={dashboardPermissionLevels}
              onChange={() => {}}
              isDisabled={true}
              className="gf-form-select-box__control--menu-right"
              value={currentPermissionLevel}
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
  }
}
