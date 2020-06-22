import React, { Component } from 'react';
import { LegacyForms, Icon } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';
const { Select } = LegacyForms;

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
          <Icon size="lg" name="shield" />
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
            <Icon name="lock" />
          </button>
        </td>
      </tr>
    );
  }
}
