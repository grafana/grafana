import { memo } from 'react';

import { Trans } from '@grafana/i18n';
import { Role } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

interface Props {
  roles: Role[];
  teams: TeamWithRoles[];
  orgs: UserOrg[];
}

interface RoleRow {
  roleName: string;
  roleDisplayName: string;
  source: string;
  orgName: string;
}

export const UserRoles = memo(({ roles, teams, orgs }: Props) => {
  const roleRows = transformRolesToRows(roles, teams, orgs);

  if (roleRows.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="page-heading">
        <Trans i18nKey="admin.user-roles.title">Permissions</Trans>
      </h3>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th>
              <Trans i18nKey="admin.user-roles.role-column">Role Name</Trans>
            </th>
            <th>
              <Trans i18nKey="admin.user-roles.source-column">Source</Trans>
            </th>
            <th>
              <Trans i18nKey="admin.user-roles.org-column">Organization</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {roleRows.map((row, index) => (
            <tr key={`${row.roleName}-${row.orgName}-${index}`}>
              <td>{row.roleDisplayName || row.roleName}</td>
              <td>{row.source}</td>
              <td>{row.orgName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

UserRoles.displayName = 'UserRoles';

function transformRolesToRows(roles: Role[], teams: TeamWithRoles[], orgs: UserOrg[]): RoleRow[] {
  const rows: RoleRow[] = [];

  // Build a map of role name -> teams that have this role
  const roleToTeams = new Map<string, Set<number>>();
  teams.forEach((team) => {
    team.roles?.forEach((role) => {
      if (!roleToTeams.has(role.name)) {
        roleToTeams.set(role.name, new Set());
      }
      roleToTeams.get(role.name)!.add(team.id);
    });
  });

  // Process each role - for now we get roles for the user's primary org
  // The org name will be from the user's org list
  roles.forEach((role) => {
    // Since we're fetching roles for a specific orgId in the action,
    // we can use the first org as the context or show "Current Organization"
    const orgName = orgs.length > 0 ? orgs[0].name : 'Unknown';
    const teamsWithRole = roleToTeams.get(role.name);

    let source: string;
    if (role.mapped) {
      source = 'External (LDAP/OAuth)';
    } else if (role.name.startsWith('basic:')) {
      source = 'Organization Role';
    } else if (teamsWithRole && teamsWithRole.size > 0) {
      const teamCount = teamsWithRole.size;
      source = teamCount === 1 ? '1 team' : `${teamCount} teams`;
    } else {
      source = 'Direct';
    }

    rows.push({
      roleName: role.name,
      roleDisplayName: role.displayName || role.name,
      source,
      orgName,
    });
  });

  // Add organization basic roles
  orgs.forEach((org) => {
    rows.push({
      roleName: `basic:${org.role}`,
      roleDisplayName: org.role,
      source: 'Organization Role',
      orgName: org.name,
    });
  });

  return rows;
}
