import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, OrgRole, TimeZone, dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Label, TextLink, useStyles2 } from '@grafana/ui';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { ServiceAccountDTO } from 'app/types/serviceaccount';

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
      <h3>
        <Trans i18nKey="serviceaccounts.service-account-profile.information">Information</Trans>
      </h3>
      <table className="filter-table">
        <tbody>
          {serviceAccount.id && (
            <ServiceAccountProfileRow
              label={t('serviceaccounts.service-account-profile.label-numerical-identifier', 'Numerical identifier')}
              value={serviceAccount.id.toString()}
              disabled={true}
            />
          )}
          <ServiceAccountProfileRow
            label={t('serviceaccounts.service-account-profile.label-name', 'Name')}
            value={serviceAccount.name}
            onChange={!serviceAccount.isExternal ? onNameChange : undefined}
            disabled={!ableToWrite || serviceAccount.isDisabled}
          />
          <ServiceAccountProfileRow
            label={t('serviceaccounts.service-account-profile.label-id', 'ID')}
            value={serviceAccount.login}
            disabled={serviceAccount.isDisabled}
          />
          <ServiceAccountRoleRow
            label={t('serviceaccounts.service-account-profile.label-roles', 'Roles')}
            serviceAccount={serviceAccount}
            onRoleChange={onRoleChange}
            roleOptions={roles}
          />
          <ServiceAccountProfileRow
            label={t('serviceaccounts.service-account-profile.label-creation-date', 'Creation date')}
            value={dateTimeFormat(serviceAccount.createdAt, { timeZone })}
            disabled={serviceAccount.isDisabled}
          />
          {serviceAccount.isExternal && serviceAccount.requiredBy && (
            <tr>
              <td>
                <Label>
                  <Trans i18nKey="serviceaccounts.service-account-profile.used-by">Used by</Trans>
                </Label>
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
