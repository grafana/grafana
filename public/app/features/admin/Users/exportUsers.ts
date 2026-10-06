import { saveAs } from 'file-saver';
import Papa from 'papaparse';

import { t } from '@grafana/i18n';
import { type OrgUser, type UserDTO } from 'app/types/user';

import {
  canShowRoles,
  getOrgUsers,
  getUserRoles,
  getUsersPage,
  isNeverLoggedIn,
  type UserSearchOptions,
} from './utils';

export type UserExportOptions = UserSearchOptions & { scope: 'all' | 'organization' };

interface UserPage<T> {
  users: T[];
  totalCount: number;
}

async function loadAllPages<T>(loadPage: (page: number) => Promise<UserPage<T>>): Promise<T[]> {
  const users: T[] = [];
  for (let page = 1; ; page++) {
    const result = await loadPage(page);
    users.push(...result.users);
    if (users.length >= result.totalCount || result.users.length === 0) {
      return users;
    }
  }
}

export async function exportUsers({ scope, ...options }: UserExportOptions): Promise<void> {
  const perPage = 1000;
  let csv: string;
  if (scope === 'all') {
    const users = await loadAllPages((page) => getUsersPage({ ...options, page, perPage }));
    csv = usersToCsv(users);
  } else {
    const users = await loadAllPages(async (page) => {
      const result = await getOrgUsers({ ...options, page, perPage });
      if (canShowRoles() && result.orgUsers.length > 0) {
        const roles = await getUserRoles(result.orgUsers.map((user) => user.userId));
        result.orgUsers.forEach((user) => {
          user.roles = roles?.[user.userId] ?? [];
        });
      }
      return { users: result.orgUsers, totalCount: result.totalCount };
    });
    csv = orgUsersToCsv(users);
  }
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${scope}-users.csv`, { autoBom: true });
}

// Never-logged-in users carry a placeholder lastSeenAt, so leave the cell blank for them.
function lastActiveCell(user: Pick<UserDTO, 'lastSeenAt' | 'created'>): string {
  return isNeverLoggedIn(user) ? '' : (user.lastSeenAt ?? '');
}

function statusCells(user: Pick<UserDTO, 'authLabels' | 'isProvisioned' | 'isDisabled'>): string[] {
  return [user.authLabels?.[0] ?? '', user.isProvisioned ? 'Provisioned' : '', user.isDisabled ? 'Disabled' : ''];
}

export function usersToCsv(users: UserDTO[]): string {
  const showBelongsTo = users.some((user) => user.orgs);
  const showLicensedRole = users.some((user) => user.licensedRole);
  return Papa.unparse(
    {
      fields: [
        'Login',
        'Email',
        'Name',
        ...(showBelongsTo ? ['Belongs to'] : []),
        ...(showLicensedRole ? ['Licensed role'] : []),
        'Last active',
        'Origin',
        'Provisioned',
        'Disabled',
      ],
      data: users.map((user) => [
        user.login,
        user.email,
        user.name,
        ...(showBelongsTo
          ? [
              [
                ...(user.orgs?.map((org) => org.name) ?? []),
                ...(user.isAdmin ? [t('admin.users-table.columns.content-grafana-admin', 'Grafana Admin')] : []),
              ].join('; '),
            ]
          : []),
        ...(showLicensedRole
          ? [
              user.licensedRole === 'None'
                ? t('admin.users-table.no-licensed-roles', 'Not assigned')
                : (user.licensedRole ?? ''),
            ]
          : []),
        lastActiveCell(user),
        ...statusCells(user),
      ]),
    },
    { escapeFormulae: true }
  );
}

export function orgUsersToCsv(users: OrgUser[]): string {
  return Papa.unparse(
    {
      fields: ['Login', 'Email', 'Name', 'Last active', 'Role', 'Origin', 'Provisioned', 'Disabled'],
      data: users.map((user) => [
        user.login,
        user.email,
        user.name,
        lastActiveCell(user),
        [user.role, ...(user.roles?.map((role) => `${role.group}:${role.displayName || role.name}`) ?? [])].join('; '),
        ...statusCells(user),
      ]),
    },
    { escapeFormulae: true }
  );
}
