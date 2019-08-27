import React, { FC } from 'react';
import { LdapTeam } from '../../types';

interface Props {
  teams: LdapTeam[];
  className: string;
}

export const LdapUserTeams: FC<Props> = ({ className, teams }) => {
  return (
    <table className={`${className} filter-table form-inline`}>
      <thead>
        <tr>
          <th>Organisation</th>
          <th>Team</th>
          <th>LDAP</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team, index) => {
          return (
            <tr key={`${team.teamId}-${index}`}>
              <td className="width-16">{team.orgId}</td>
              <td className="width-14">{team.teamId}</td>
              <td>{team.ldapAttribute}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
