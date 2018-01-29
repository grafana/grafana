import React, { Component } from 'react';
import DescriptionPicker from 'app/core/components/Picker/DescriptionPicker';
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
          <div className="gf-form">
            <DescriptionPicker
              optionsWithDesc={permissionOptions}
              handlePicked={() => {}}
              value={item.permission}
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
  }
}
