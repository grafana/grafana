import React, { useState } from 'react';

import { ConfirmButton, RadioButtonGroup, Icon } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

interface Props {
  isGrafanaAdmin: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

const adminOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export function UserPermissions({ isGrafanaAdmin, onGrafanaAdminChange }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentAdminOption, setCurrentAdminOption] = useState(isGrafanaAdmin);

  const onChangeClick = () => setIsEditing(true);

  const onCancelClick = () => {
    setIsEditing(false);
    setCurrentAdminOption(isGrafanaAdmin);
  };

  const handleGrafanaAdminChange = () => onGrafanaAdminChange(currentAdminOption);

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
                      onChange={setCurrentAdminOption}
                      autoFocus
                    />
                  </td>
                ) : (
                  <td colSpan={2}>
                    {isGrafanaAdmin ? (
                      <>
                        <Icon name="shield" /> Yes
                      </>
                    ) : (
                      <>No</>
                    )}
                  </td>
                )}
                <td>
                  {canChangePermissions && (
                    <ConfirmButton
                      onClick={onChangeClick}
                      onConfirm={handleGrafanaAdminChange}
                      onCancel={onCancelClick}
                      confirmText="Change"
                    >
                      Change
                    </ConfirmButton>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
