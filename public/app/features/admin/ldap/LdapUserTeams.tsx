import React, { FC } from 'react';
import { Tooltip } from '@grafana/ui';
import { LdapTeam } from 'app/types';

interface Props {
  teams: LdapTeam[];
  showAttributeMapping?: boolean;
}

export const LdapUserTeams: FC<Props> = ({ teams, showAttributeMapping }) => {
  const items = showAttributeMapping ? teams : teams.filter(item => item.teamName);

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              {showAttributeMapping && <th>LDAP Group</th>}
              <th>Organisation</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {items.map((team, index) => {
              return (
                <tr key={`${team.teamName}-${index}`}>
                  {showAttributeMapping && (
                    <>
                      <td>{team.groupDN}</td>
                      {!team.orgName && (
                        <>
                          <td />
                          <td>
                            <div className="text-warning">
                              No match
                              <Tooltip placement="top" content="No matching teams found" theme={'info'}>
                                <span className="gf-form-help-icon">
                                  <i className="fa fa-info-circle" />
                                </span>
                              </Tooltip>
                            </div>
                          </td>
                        </>
                      )}
                    </>
                  )}
                  {team.orgName && (
                    <>
                      <td>{team.orgName}</td>
                      <td>{team.teamName}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
