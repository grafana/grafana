import React from 'react';
import { observer } from 'mobx-react';
import DescriptionPicker from 'app/core/components/Picker/DescriptionPicker';
import { permissionOptions } from 'app/stores/PermissionsStore/PermissionsStore';

const setClassNameHelper = inherited => {
  return inherited ? 'gf-form-disabled' : '';
};

export default observer(({ item, removeItem, permissionChanged, itemIndex, folderTitle }) => {
  const handleRemoveItem = evt => {
    evt.preventDefault();
    removeItem(itemIndex);
  };

  const handleChangePermission = permissionOption => {
    permissionChanged(itemIndex, permissionOption.value, permissionOption.label);
  };

  return (
    <tr className={setClassNameHelper(item.inherited)}>
      <td style={{ width: '100%' }}>
        <i className={item.icon} />
        <span dangerouslySetInnerHTML={{ __html: item.nameHtml }} />
      </td>
      <td>{item.inherited ? <em className="muted no-wrap">Inherited from folder {folderTitle} </em> : null}</td>
      <td className="query-keyword">Can</td>
      <td>
        <div className="gf-form">
          <DescriptionPicker
            optionsWithDesc={permissionOptions}
            handlePicked={handleChangePermission}
            value={item.permission}
            disabled={item.inherited}
          />
        </div>
      </td>
      <td>
        {!item.inherited ? (
          <a className="btn btn-danger btn-small" onClick={handleRemoveItem}>
            <i className="fa fa-remove" />
          </a>
        ) : null}
      </td>
    </tr>
  );
});
