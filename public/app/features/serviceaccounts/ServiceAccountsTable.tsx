import React, { FC, useEffect, useState } from 'react';
import { AccessControlAction, Role, OrgServiceAccount } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { Button, ConfirmModal } from '@grafana/ui';
import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { fetchBuiltinRoles, fetchRoleOptions, UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';

export interface Props {
  serviceAccounts: OrgServiceAccount[];
  orgId?: number;
  onRoleChange: (role: OrgRole, serviceAccount: OrgServiceAccount) => void;
  onRemoveServiceAccount: (serviceAccount: OrgServiceAccount) => void;
}

const ServiceAccountsTable: FC<Props> = (props) => {
  const { serviceAccounts, orgId, onRoleChange, onRemoveServiceAccount } = props;
  const canUpdateRole = contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate);
  const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove);
  const rolePickerDisabled = !canUpdateRole;

  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [toRemove, setToRemove] = useState<OrgServiceAccount | null>(null);
  const [builtinRoles, setBuiltinRoles] = useState<Record<string, Role[]>>({});
  const [showRemoveModal, setShowRemoveModal] = useState<boolean | string>(false);

  useEffect(() => {
    async function fetchOptions() {
      try {
        let options = await fetchRoleOptions(orgId);
        setRoleOptions(options);
        const builtInRoles = await fetchBuiltinRoles(orgId);
        setBuiltinRoles(builtInRoles);
      } catch (e) {
        console.error('Error loading options');
      }
    }
    if (contextSrv.accessControlEnabled()) {
      fetchOptions();
    }
  }, [orgId]);

  const getRoleOptions = async () => roleOptions;
  const getBuiltinRoles = async () => builtinRoles;

  return (
    <>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th />
            <th>Login</th>
            <th>Email</th>
            <th>Name</th>
            <th>Seen</th>
            <th>Role</th>
            <th style={{ width: '34px' }} />
          </tr>
        </thead>
        <tbody>
          {serviceAccounts.map((serviceAccount, index) => {
            return (
              <tr key={`${serviceAccount.serviceAccountId}-${index}`}>
                <td className="width-2 text-center">
                  <img className="filter-table__avatar" src={serviceAccount.avatarUrl} alt="serviceaccount avatar" />
                </td>
                <td className="max-width-6">
                  <span className="ellipsis" title={serviceAccount.login}>
                    {serviceAccount.login}
                  </span>
                </td>

                <td className="max-width-5">
                  <span className="ellipsis" title={serviceAccount.email}>
                    {serviceAccount.email}
                  </span>
                </td>
                <td className="max-width-5">
                  <span className="ellipsis" title={serviceAccount.name}>
                    {serviceAccount.name}
                  </span>
                </td>

                <td className="width-8">
                  {contextSrv.accessControlEnabled() ? (
                    <UserRolePicker
                      userId={serviceAccount.serviceAccountId}
                      orgId={orgId}
                      builtInRole={serviceAccount.role}
                      onBuiltinRoleChange={(newRole) => onRoleChange(newRole, serviceAccount)}
                      getRoleOptions={getRoleOptions}
                      getBuiltinRoles={getBuiltinRoles}
                      disabled={rolePickerDisabled}
                    />
                  ) : (
                    <OrgRolePicker
                      aria-label="Role"
                      value={serviceAccount.role}
                      disabled={!canUpdateRole}
                      onChange={(newRole) => onRoleChange(newRole, serviceAccount)}
                    />
                  )}
                </td>
                {canRemoveFromOrg && (
                  <td>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowRemoveModal(serviceAccount.login)}
                      icon="times"
                      aria-label="Delete serviceaccount"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {toRemove !== null && (
        <ConfirmModal
          body={`Are you sure you want to delete ${toRemove.login} service account?`}
          confirmText="Delete"
          title="Delete"
          onDismiss={() => setToRemove(null)}
          isOpen={toRemove.login === showRemoveModal}
          onConfirm={() => onRemoveServiceAccount(toRemove)}
        />
      )}
    </>
  );
};

export default ServiceAccountsTable;
