import React, { Component } from 'react';
import { permissionOptions } from 'app/stores/PermissionsStore/PermissionsStore';

export interface IProps {
  item: any;
}

export default class DisabledPermissionListItem extends Component<IProps, any> {
  render() {
    const { item } = this.props;

    return (
      <tr className="gf-form-disabled">
        <td style={{ width: '100%' }}>
          <i className={item.icon} />
          <span dangerouslySetInnerHTML={{ __html: item.nameHtml }} />
        </td>
        <td />
        <td className="query-keyword">Can</td>
        <td>
          <div className="gf-form-select-wrapper">
            <select value={item.permission} className="gf-form-input gf-size-auto" disabled={true}>
              {permissionOptions.map((option, idx) => {
                return (
                  <option key={idx} value={option.value}>
                    {option.text}
                  </option>
                );
              })}
            </select>
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
