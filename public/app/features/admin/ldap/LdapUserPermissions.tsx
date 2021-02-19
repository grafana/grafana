import React, { FC } from 'react';
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
                    <i className="gicon gicon-shield" /> Yes
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
                    <i className="fa fa-fw fa-times" /> Inactive
                  </>
                ) : (
                  <>
                    <i className="fa fa-fw fa-check" /> Active
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
