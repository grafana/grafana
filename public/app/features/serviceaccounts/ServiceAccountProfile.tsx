import React from 'react';
import { useDispatch } from 'react-redux';

import { dateTimeFormat, OrgRole, TimeZone } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role, ServiceAccountDTO } from 'app/types';

import { ServiceAccountProfileRow } from './components/ServiceAccountProfileRow';
import { ServiceAccountRoleRow } from './components/ServiceAccountRoleRow';
import { updateServiceAccount } from './state/actionsServiceAccountPage';

interface Props {
  serviceAccount: ServiceAccountDTO;
  timeZone: TimeZone;

  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
}

export function ServiceAccountProfile({ serviceAccount, timeZone, roleOptions, builtInRoles }: Props): JSX.Element {
  const dispatch = useDispatch();
  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);

  const handleServiceAccountRoleChange = (role: OrgRole) => {
    dispatch(updateServiceAccount({ ...serviceAccount, role: role }));
  };

  const onServiceAccountNameChange = (newValue: string) => {
    dispatch(updateServiceAccount({ ...serviceAccount, name: newValue }));
  };

  return (
    <>
      <h4>Information</h4>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <tbody>
              <ServiceAccountProfileRow
                label="Name"
                value={serviceAccount.name}
                onChange={onServiceAccountNameChange}
                disabled={!ableToWrite || serviceAccount.isDisabled}
              />
              <ServiceAccountProfileRow label="ID" value={serviceAccount.login} disabled={serviceAccount.isDisabled} />
              <ServiceAccountRoleRow
                label="Roles"
                serviceAccount={serviceAccount}
                onRoleChange={handleServiceAccountRoleChange}
                builtInRoles={builtInRoles}
                roleOptions={roleOptions}
              />
              {/* <ServiceAccountProfileRow label="Teams" value={serviceAccount.teams.join(', ')} /> */}
              <ServiceAccountProfileRow
                label="Creation date"
                value={dateTimeFormat(serviceAccount.createdAt, { timeZone })}
                disabled={serviceAccount.isDisabled}
              />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
