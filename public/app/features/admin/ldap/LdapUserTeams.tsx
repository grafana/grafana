import React, { FC } from 'react';
import { css } from 'emotion';
import { Tooltip } from '@grafana/ui';
import { LdapTeam } from 'app/types';

interface Props {
  teams: LdapTeam[];
  showAttributeMapping?: boolean;
}

export const LdapUserTeams: FC<Props> = ({ teams, showAttributeMapping }) => {
  const items = showAttributeMapping ? teams : teams.filter(item => item.teamName);
  const teamColumnClass = showAttributeMapping && 'width-14';
  const noMatchPlaceholderStyle = css`
    display: flex;
  `;

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Team</th>
              {showAttributeMapping && <th>LDAP</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((team, index) => {
              return (
                <tr key={`${team.teamName}-${index}`}>
                  <td className="width-16">
                    {team.orgName || (
                      <div className={`text-warning ${noMatchPlaceholderStyle}`}>
                        No match
                        <Tooltip placement="top" content="No matching teams found" theme={'info'}>
                          <div className="gf-form-help-icon gf-form-help-icon--right-normal">
                            <i className="fa fa-info-circle" />
                          </div>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                  <td className={teamColumnClass}>{team.teamName}</td>
                  {showAttributeMapping && <td>{team.groupDN}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
