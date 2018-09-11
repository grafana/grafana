import React from 'react';
import { observer } from 'mobx-react';
import DescriptionPicker from 'app/core/components/Picker/DescriptionPicker';
import { permissionOptions } from 'app/stores/PermissionsStore/PermissionsStore';

const setClassNameHelper = inherited => {
  return inherited ? 'gf-form-disabled' : '';
};

function ItemAvatar({ item }) {
  if (item.userAvatarUrl) {
    return <img className="filter-table__avatar" src={item.userAvatarUrl} />;
  }
  if (item.teamAvatarUrl) {
    return <img className="filter-table__avatar" src={item.teamAvatarUrl} />;
  }
  if (item.role === 'Editor') {
    return <i style={{ width: '25px', height: '25px' }} className="gicon gicon-editor" />;
  }

  return <i style={{ width: '25px', height: '25px' }} className="gicon gicon-viewer" />;
}

function ItemDescription({ item }) {
  if (item.userId) {
    return <span className="filter-table__weak-italic">(User)</span>;
  }
  if (item.teamId) {
    return <span className="filter-table__weak-italic">(Team)</span>;
  }
  return <span className="filter-table__weak-italic">(Role)</span>;
}

export default observer(({ item, removeItem, permissionChanged, itemIndex, folderInfo }) => {
  const handleRemoveItem = evt => {
    evt.preventDefault();
    removeItem(itemIndex);
  };

  const handleChangePermission = permissionOption => {
    permissionChanged(itemIndex, permissionOption.value, permissionOption.label);
  };

  const inheritedFromRoot = item.dashboardId === -1 && !item.inherited;

  return (
    <tr className={setClassNameHelper(item.inherited)}>
      <td style={{ width: '1%' }}>
        <ItemAvatar item={item} />
      </td>
      <td style={{ width: '90%' }}>
        {item.name} <ItemDescription item={item} />
      </td>
      <td>
        {item.inherited &&
          folderInfo && (
            <em className="muted no-wrap">
              Inherited from folder{' '}
              <a className="text-link" href={`${folderInfo.url}/permissions`}>
                {folderInfo.title}
              </a>{' '}
            </em>
          )}
        {inheritedFromRoot && <em className="muted no-wrap">Default Permission</em>}
      </td>
      <td className="query-keyword">Can</td>
      <td>
        <div className="gf-form">
          <DescriptionPicker
            optionsWithDesc={permissionOptions}
            onSelected={handleChangePermission}
            value={item.permission}
            disabled={item.inherited}
            className={'gf-form-input--form-dropdown-right'}
          />
        </div>
      </td>
      <td>
        {!item.inherited ? (
          <a className="btn btn-danger btn-small" onClick={handleRemoveItem}>
            <i className="fa fa-remove" />
          </a>
        ) : (
          <button className="btn btn-inverse btn-small">
            <i className="fa fa-lock" />
          </button>
        )}
      </td>
    </tr>
  );
});
