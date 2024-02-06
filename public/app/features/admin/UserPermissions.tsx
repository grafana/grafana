import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmButton, RadioButtonGroup, Icon, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ExternalUserTooltip } from 'app/features/admin/UserOrgs';
import { AccessControlAction } from 'app/types';

interface Props {
  isGrafanaAdmin: boolean;
  isExternalUser?: boolean;
  lockMessage?: string;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

const adminOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export function UserPermissions({ isGrafanaAdmin, isExternalUser, lockMessage, onGrafanaAdminChange }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentAdminOption, setCurrentAdminOption] = useState(isGrafanaAdmin);

  const onChangeClick = () => setIsEditing(true);

  const onCancelClick = () => {
    setIsEditing(false);
    setCurrentAdminOption(isGrafanaAdmin);
  };

  const handleGrafanaAdminChange = () => onGrafanaAdminChange(currentAdminOption);

  const canChangePermissions = contextSrv.hasPermission(AccessControlAction.UsersPermissionsUpdate) && !isExternalUser;

  const styles = useStyles2(getTooltipStyles);

  return (
    <div>
      <h3 className="page-heading">Permissions</h3>
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
              {isExternalUser && (
                <div className={styles.lockMessageClass}>
                  <ExternalUserTooltip lockMessage={lockMessage} />
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  lockMessageClass: css`
    display: flex;
    justify-content: flex-end;
    font-style: italic;
    margin-right: ${theme.spacing(0.6)};
  `,
});
