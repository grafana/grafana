import { memo } from 'react';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import { Role } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

interface Props {
  roles: Role[];
  teams: TeamWithRoles[];
  orgs: UserOrg[];
  userUid?: string;
}

interface RoleRow {
  roleName: string;
  roleDisplayName: string;
  source: string;
  orgName: string;
}

export const UserRoles = memo(({ roles, teams, orgs, userUid }: Props) => {
  const roleRows = transformRolesToRows(roles, teams, orgs);

  if (roleRows.length === 0) {
    return null;
  }

  return (
    <div>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <h3 className="page-heading">
          <Trans i18nKey="admin.user-roles.title">Permissions</Trans>
        </h3>
        {userUid && (
          <LinkButton href={`/admin/users/roles/${userUid}`} variant="secondary" size="sm">
            View Detailed Permissions
          </LinkButton>
        )}
      </Stack>
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
  const processedRoles = new Set<string>();

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

  // Process roles returned from the API
  roles.forEach((role) => {
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
    processedRoles.add(role.name);
  });

  // Add any team roles that weren't in the API response
  // This handles cases where roles are only granted through team membership
  teams.forEach((team) => {
    team.roles?.forEach((role) => {
      if (!processedRoles.has(role.name)) {
        const orgName = orgs.length > 0 ? orgs[0].name : 'Unknown';
        const teamsWithRole = roleToTeams.get(role.name);
        const teamCount = teamsWithRole?.size || 0;

        rows.push({
          roleName: role.name,
          roleDisplayName: role.displayName || role.name,
          source: teamCount === 1 ? '1 team' : `${teamCount} teams`,
          orgName,
        });
        processedRoles.add(role.name);
      }
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
