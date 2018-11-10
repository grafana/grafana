import React, { Component } from 'react';
import DescriptionPicker from 'app/core/components/Picker/DescriptionPicker';
import { dashboardPermissionLevels } from 'app/types/acl';

export interface Props {
  item: any;
}

export default class DisabledPermissionListItem extends Component<Props, any> {
  render() {
    const { item } = this.props;

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
            <DescriptionPicker
              optionsWithDesc={dashboardPermissionLevels}
              onSelected={() => {}}
              disabled={true}
              className={'gf-form-select-box__control--menu-right'}
              value={item.permission}
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
