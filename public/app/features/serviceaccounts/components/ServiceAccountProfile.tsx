import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { dateTimeFormat, GrafanaTheme2, OrgRole, TimeZone } from '@grafana/data';
import { Label, TextLink, useStyles2 } from '@grafana/ui';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role, ServiceAccountDTO } from 'app/types';

import { ServiceAccountProfileRow } from './ServiceAccountProfileRow';
import { ServiceAccountRoleRow } from './ServiceAccountRoleRow';

interface Props {
  serviceAccount: ServiceAccountDTO;
  timeZone: TimeZone;
  onChange: (serviceAccount: ServiceAccountDTO) => void;
}

export function ServiceAccountProfile({ serviceAccount, timeZone, onChange }: Props): JSX.Element {
  const styles = useStyles2(getStyles);
  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);
  const [roles, setRoleOptions] = useState<Role[]>([]);

  const onRoleChange = (role: OrgRole) => {
    onChange({ ...serviceAccount, role: role });
  };

  const onNameChange = (newValue: string) => {
    onChange({ ...serviceAccount, name: newValue });
  };

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(serviceAccount.orgId);
          setRoleOptions(options);
        }
      } catch (e) {
        console.error('Error loading options for service account');
      }
    }
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchOptions();
    }
  }, [serviceAccount.orgId]);

  return (
    <div className={styles.section}>
      <h3>Information</h3>
      <table className="filter-table">
        <tbody>
          <ServiceAccountProfileRow label="Numerical identifier" value={serviceAccount.id.toString()} disabled={true} />
          <ServiceAccountProfileRow
            label="Name"
            value={serviceAccount.name}
            onChange={!serviceAccount.isExternal ? onNameChange : undefined}
            disabled={!ableToWrite || serviceAccount.isDisabled}
          />
          <ServiceAccountProfileRow label="ID" value={serviceAccount.login} disabled={serviceAccount.isDisabled} />
          <ServiceAccountRoleRow
            label="Roles"
            serviceAccount={serviceAccount}
            onRoleChange={onRoleChange}
            roleOptions={roles}
          />
          <ServiceAccountProfileRow
            label="Creation date"
            value={dateTimeFormat(serviceAccount.createdAt, { timeZone })}
            disabled={serviceAccount.isDisabled}
          />
          {serviceAccount.isExternal && serviceAccount.requiredBy && (
            <tr>
              <td>
                <Label>Used by</Label>
              </td>
              <td>
                <TextLink href={`/plugins/${serviceAccount.requiredBy}`}>{serviceAccount.requiredBy}</TextLink>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    marginBottom: theme.spacing(4),
  }),
});
