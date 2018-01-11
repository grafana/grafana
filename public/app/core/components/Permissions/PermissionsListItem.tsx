import React from 'react';

const setClassNameHelper = inherited => {
  return inherited ? 'gf-form-disabled' : '';
};

export default ({ item, permissionsOptions, removeItem, permissionChanged, itemIndex }) => {
  const handleRemoveItem = evt => {
    evt.preventDefault();
    removeItem(itemIndex);
  };

  const handleChangePermission = evt => {
    evt.preventDefault();
    permissionChanged(itemIndex, evt.target.value);
  };

  return (
    <tr className={setClassNameHelper(item.inherited)}>
      <td style={{ width: '100%' }}>
        {/*  style="width: 100%;" */}
        <i className={item.icon} />
        <span dangerouslySetInnerHTML={{ __html: item.nameHtml }} />
      </td>
      <td>{item.inherited ? <em className="muted no-wrap">Inherited from folder</em> : null}</td>
      <td className="query-keyword">Can</td>
      <td>
        <div className="gf-form-select-wrapper">
          <select
            value={item.permission}
            className="gf-form-input gf-size-auto"
            onChange={handleChangePermission}
            disabled={item.inherited}
          >
            {permissionsOptions.map((option, idx) => {
              return (
                <option key={idx} value={option.value}>
                  {option.text}
                </option>
              );
            })}
          </select>

          {/* <select className="gf-form-input gf-size-auto"
                        ng-model="acl.permission"
                        ng-options="p.value as p.text for p in ctrl.permissionOptions"
                        ng-change="ctrl.permissionChanged(acl)"
                        ng-disabled="acl.inherited" /> */}
        </div>
      </td>
      <td>
        {!item.inherited ? (
          <a className="btn btn-inverse btn-small" onClick={handleRemoveItem}>
            <i className="fa fa-remove" />
          </a>
        ) : null}
      </td>
    </tr>
  );
};
