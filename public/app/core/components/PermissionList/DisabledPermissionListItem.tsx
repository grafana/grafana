import React, { Component } from 'react';
import { Select, Icon, Button } from '@grafana/ui';
import { dashboardPermissionLevels } from 'app/types/acl';

export interface Props {
  item: any;
}

export default class DisabledPermissionListItem extends Component<Props, any> {
  render() {
    const { item } = this.props;
    const currentPermissionLevel = dashboardPermissionLevels.find((dp) => dp.value === item.permission);

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
              menuShouldPortal
              options={dashboardPermissionLevels}
              onChange={() => {}}
              disabled={true}
              value={currentPermissionLevel}
            />
          </div>
        </td>
        <td>
          <Button size="sm" disabled icon="lock" />
        </td>
      </tr>
    );
  }
}
