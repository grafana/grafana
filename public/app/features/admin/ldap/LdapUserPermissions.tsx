import React, { FC } from 'react';

import { Icon } from '@grafana/ui';
import { LdapPermissions } from 'app/types';

interface Props {
  permissions: LdapPermissions;
}

export const LdapUserPermissions: FC<Props> = ({ permissions }) => {
  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th colSpan={1}>Permissions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="width-16"> Grafana admin</td>
              <td>
                {permissions.isGrafanaAdmin ? (
                  <>
                    <Icon name="shield" /> Yes
                  </>
                ) : (
                  'No'
                )}
              </td>
            </tr>
            <tr>
              <td className="width-16">Status</td>
              <td>
                {permissions.isDisabled ? (
                  <>
                    <Icon name="times" /> Inactive
                  </>
                ) : (
                  <>
                    <Icon name="check" /> Active
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
