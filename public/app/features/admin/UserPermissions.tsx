import React, { useState } from 'react';
import { ConfirmButton, RadioButtonGroup, Icon } from '@grafana/ui';
import { cx } from '@emotion/css';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/core';

interface Props {
  isGrafanaAdmin: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

const adminOptions = [
  { label: 'Yes', value: 'YES' },
  { label: 'No', value: 'NO' },
];

export function UserPermissions(props: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentAdminOption, setCurrentAdminOption] = useState(props.isGrafanaAdmin ? 'YES' : 'NO');

  const onChangeClick = () => {
    setIsEditing(true);
  };

  const onCancelClick = () => {
    setIsEditing(false);
    setCurrentAdminOption(props.isGrafanaAdmin ? 'YES' : 'NO');
  };

  const onGrafanaAdminChange = () => {
    const newIsGrafanaAdmin = currentAdminOption === 'YES' ? true : false;
    props.onGrafanaAdminChange(newIsGrafanaAdmin);
  };

  const onAdminOptionSelect = (value: string) => {
    setCurrentAdminOption(value);
  };

  const changeButtonContainerClass = cx('pull-right');
  const canChangePermissions = contextSrv.hasPermission(AccessControlAction.UsersPermissionsUpdate);

  return (
    <>
      <h3 className="page-heading">Permissions</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <tbody>
              <tr>
                <td className="width-16">Grafana Admin</td>
                {isEditing ? (
                  <td colSpan={2}>
                    <RadioButtonGroup
                      options={adminOptions}
                      value={currentAdminOption}
                      onChange={onAdminOptionSelect}
                      autoFocus
                    />
                  </td>
                ) : (
                  <td colSpan={2}>
                    {props.isGrafanaAdmin ? (
                      <>
                        <Icon name="shield" /> Yes
                      </>
                    ) : (
                      <>No</>
                    )}
                  </td>
                )}
                <td>
                  <div className={changeButtonContainerClass}>
                    {canChangePermissions && (
                      <ConfirmButton
                        className="pull-right"
                        onClick={onChangeClick}
                        onConfirm={onGrafanaAdminChange}
                        onCancel={onCancelClick}
                        confirmText="Change"
                      >
                        Change
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
