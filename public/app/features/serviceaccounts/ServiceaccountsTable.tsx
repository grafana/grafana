import React, { FC, useEffect, useState } from 'react';
import { AccessControlAction, Role, OrgServiceaccount } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { Button, ConfirmModal } from '@grafana/ui';
import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { fetchBuiltinRoles, fetchRoleOptions, UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';

export interface Props {
  serviceaccounts: OrgServiceaccount[];
  orgId?: number;
  onRoleChange: (role: OrgRole, serviceaccount: OrgServiceaccount) => void;
  onRemoveServiceaccount: (serviceaccount: OrgServiceaccount) => void;
}

const ServiceaccountsTable: FC<Props> = (props) => {
  const {
    serviceaccounts: serviceaccounts,
    orgId,
    onRoleChange,
    onRemoveServiceaccount: onRemoveserviceaccount,
  } = props;
  const canUpdateRole = contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate);
  const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove);
  const rolePickerDisabled = !canUpdateRole;

  const [showRemoveModal, setShowRemoveModal] = useState<string | boolean>(false);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<{ [key: string]: Role[] }>({});

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
        {serviceaccounts.map((serviceaccount, index) => {
          return (
            <tr key={`${serviceaccount.serviceaccountId}-${index}`}>
              <td className="width-2 text-center">
                <img className="filter-table__avatar" src={serviceaccount.avatarUrl} alt="serviceaccount avatar" />
              </td>
              <td className="max-width-6">
                <span className="ellipsis" title={serviceaccount.login}>
                  {serviceaccount.login}
                </span>
              </td>

              <td className="max-width-5">
                <span className="ellipsis" title={serviceaccount.email}>
                  {serviceaccount.email}
                </span>
              </td>
              <td className="max-width-5">
                <span className="ellipsis" title={serviceaccount.name}>
                  {serviceaccount.name}
                </span>
              </td>
              <td className="width-1">{serviceaccount.lastSeenAtAge}</td>

              <td className="width-8">
                {contextSrv.accessControlEnabled() ? (
                  <UserRolePicker
                    userId={serviceaccount.serviceaccountId}
                    orgId={orgId}
                    builtInRole={serviceaccount.role}
                    onBuiltinRoleChange={(newRole) => onRoleChange(newRole, serviceaccount)}
                    getRoleOptions={getRoleOptions}
                    getBuiltinRoles={getBuiltinRoles}
                    disabled={rolePickerDisabled}
                  />
                ) : (
                  <OrgRolePicker
                    aria-label="Role"
                    value={serviceaccount.role}
                    disabled={!canUpdateRole}
                    onChange={(newRole) => onRoleChange(newRole, serviceaccount)}
                  />
                )}
              </td>

              {canRemoveFromOrg && (
                <td>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowRemoveModal(serviceaccount.login)}
                    icon="times"
                    aria-label="Delete serviceaccount"
                  />
                  <ConfirmModal
                    body={`Are you sure you want to delete serviceaccount ${serviceaccount.login}?`}
                    confirmText="Delete"
                    title="Delete"
                    onDismiss={() => setShowRemoveModal(false)}
                    isOpen={serviceaccount.login === showRemoveModal}
                    onConfirm={() => {
                      onRemoveserviceaccount(serviceaccount);
                    }}
                  />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ServiceaccountsTable;
