import React, { Component } from 'react';

import { Select, Icon, Button } from '@grafana/ui';
import { DashboardAcl, dashboardPermissionLevels } from 'app/types/acl';

export interface Props {
  item: DashboardAcl;
}

export default class DisabledPermissionListItem extends Component<Props> {
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
              aria-label={`Permission level for "${item.name}"`}
              options={dashboardPermissionLevels}
              onChange={() => {}}
              disabled={true}
              value={currentPermissionLevel}
            />
          </div>
        </td>
        <td>
          <Button aria-label={`Remove permission for "${item.name}"`} size="sm" icon="lock" disabled />
        </td>
      </tr>
    );
  }
}
