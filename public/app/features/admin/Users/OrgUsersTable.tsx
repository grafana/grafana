import { useCallback, useEffect, useMemo, useState } from 'react';

import { OrgRole } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import {
  Avatar,
  Box,
  Button,
  CellProps,
  Column,
  ConfirmModal,
  FetchDataFunc,
  Icon,
  InteractiveTable,
  Pagination,
  Stack,
  Tag,
  Text,
  TextLink,
  Tooltip,
} from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { RolePickerBadges } from 'app/core/components/RolePickerDrawer/RolePickerBadges';
import { RolePickerDrawer } from 'app/core/components/RolePickerDrawer/RolePickerDrawer';
import { TeamRole } from 'app/core/components/RolePickerDrawer/AssignRoles';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/services/context_srv';
import { useListUserRolesQuery, useListRolesQuery, useSetUserRolesMutation } from 'app/api/clients/roles';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { OrgUser } from 'app/types/user';

import { OrgRolePicker } from '../OrgRolePicker';

type Cell<T extends keyof OrgUser = keyof OrgUser> = CellProps<OrgUser, OrgUser[T]>;

const disabledRoleMessage = `This user's role is not editable because it is synchronized from your auth provider.
Refer to the Grafana authentication docs for details.`;

const getBasicRoleDisabled = (user: OrgUser) => {
  const isUserSynced = user?.isExternallySynced;
  return !contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersWrite, user) || isUserSynced;
};

const selectors = e2eSelectors.pages.UserListPage.UsersListPage;

export interface Props {
  users: OrgUser[];
  orgId?: number;
  onRoleChange: (role: OrgRole, user: OrgUser) => void;
  onRemoveUser: (user: OrgUser) => void;
  fetchData?: FetchDataFunc<OrgUser>;
  changePage: (page: number) => void;
  page: number;
  totalPages: number;
  rolesLoading?: boolean;
  onUserRolesChange?: () => void;
}

export const OrgUsersTable = ({
  users,
  orgId,
  onRoleChange,
  onUserRolesChange,
  onRemoveUser,
  fetchData,
  changePage,
  page,
  totalPages,
  rolesLoading,
}: Props) => {
  const [userToRemove, setUserToRemove] = useState<OrgUser | null>(null);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const drawerUser = drawerUserId !== null ? users.find((u) => u.userId === drawerUserId) : undefined;

  // RTK Query hooks for drawer data
  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && (drawerUser?.userId ?? 0) > 0;
  const { data: drawerUserRoles = [] } = useListUserRolesQuery(
    hasPermission ? { userId: drawerUser?.userId ?? 0, includeHidden: true, includeMapped: true, targetOrgId: orgId } : { userId: 0 },
  );
  const { data: drawerRoleOptions = [] } = useListRolesQuery(
    drawerUser ? { delegatable: true, targetOrgId: orgId } : { delegatable: true, targetOrgId: -1 },
  );
  const [updateUserRolesMutation] = useSetUserRolesMutation();

  // Fetch team roles for drawer user
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  useEffect(() => {
    if (!drawerUser || drawerUser.userId <= 0) {
      setTeamRoles([]);
      return;
    }
    let cancelled = false;
    const fetchTeamRoles = async () => {
      try {
        const teams = await getBackendSrv().get<Array<{ id: number; uid: string; name: string }>>(`/api/users/${drawerUser.userId}/teams`);
        const allTeamRoles: TeamRole[] = [];
        for (const team of teams) {
          try {
            const roles = await getBackendSrv().get<Role[]>(`/api/access-control/teams/${team.id}/roles`);
            for (const role of roles) {
              allTeamRoles.push({ role, teamName: team.name, teamUid: team.uid });
            }
          } catch {
            // Skip teams we can't fetch roles for
          }
        }
        if (!cancelled) {
          setTeamRoles(allTeamRoles);
        }
      } catch {
        // User may not have permission to list teams
      }
    };
    fetchTeamRoles();
    return () => { cancelled = true; };
  }, [drawerUser]);

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  const handleDrawerSave = useCallback(async (newRoles: Role[]) => {
    if (!drawerUser) {
      return;
    }
    const roleUids = newRoles.map((role) => role.uid);
    await updateUserRolesMutation({
      userId: drawerUser.userId,
      targetOrgId: orgId,
      setUserRolesCommand: { roleUids },
    }).unwrap();
  }, [drawerUser, orgId, updateUserRolesMutation]);

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(orgId);
          setRoleOptions(options);
        }
      } catch (e) {
        console.error('Error loading options');
      }
    }
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchOptions();
    }
  }, [orgId]);

  const columns: Array<Column<OrgUser>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => value && <Avatar src={value} alt="User avatar" />,
      },
      {
        id: 'login',
        header: 'Login',
        cell: ({ cell: { value } }: Cell<'login'>) => <div>{value}</div>,
        sortType: 'string',
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ cell: { value } }: Cell<'email'>) => value,
        sortType: 'string',
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value } }: Cell<'name'>) => value,
        sortType: 'string',
      },
      {
        id: 'lastSeenAtAge',
        header: 'Last active',
        cell: ({ cell: { value }, row: { original } }: Cell<'lastSeenAtAge'>) => {
          // If lastSeenAt is before created, user has never logged in
          const neverLoggedIn =
            original.lastSeenAt && original.created && new Date(original.lastSeenAt) < new Date(original.created);
          return (
            <>
              {value && (
                <>
                  {neverLoggedIn ? (
                    <Text color={'disabled'}>
                      <Trans i18nKey="admin.org-uers.last-seen-never">Never</Trans>
                    </Text>
                  ) : (
                    value
                  )}
                </>
              )}
            </>
          );
        },
        sortType: (a, b) => new Date(a.original.lastSeenAt).getTime() - new Date(b.original.lastSeenAt).getTime(),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const basicRoleDisabled = getBasicRoleDisabled(original);
          const onUserRolesUpdate = async (newRoles: Role[], userId: number, orgId: number | undefined) => {
            await updateUserRoles(newRoles, userId, orgId);
            if (onUserRolesChange) {
              onUserRolesChange();
            }
          };

          if (config.featureToggles.rolePickerDrawer) {
            return (
              <RolePickerBadges
                disabled={basicRoleDisabled}
                basicRole={original.role}
                roles={original.roles}
                onOpenDrawer={() => setDrawerUserId(original.userId)}
              />
            );
          }

          return contextSrv.licensedAccessControlEnabled() ? (
            <UserRolePicker
              userId={original.userId}
              roles={original.roles}
              apply={true}
              onApplyRoles={onUserRolesUpdate}
              isLoading={rolesLoading}
              orgId={orgId}
              roleOptions={roleOptions}
              basicRole={value}
              onBasicRoleChange={(newRole) => onRoleChange(newRole, original)}
              basicRoleDisabled={basicRoleDisabled}
              basicRoleDisabledMessage={disabledRoleMessage}
              width={40}
            />
          ) : (
            <OrgRolePicker
              aria-label={t('admin.org-users-table.columns.aria-label-role', 'Role')}
              value={value}
              disabled={basicRoleDisabled}
              onChange={(newRole) => onRoleChange(newRole, original)}
            />
          );
        },
      },
      {
        id: 'info',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          const basicRoleDisabled = getBasicRoleDisabled(original);
          return (
            basicRoleDisabled && (
              <Box display={'flex'} alignItems={'center'} marginLeft={1}>
                <Tooltip
                  interactive={true}
                  content={
                    <div>
                      <Trans i18nKey="admin.org-users.not-editable">
                        This user&apos;s role is not editable because it is synchronized from your auth provider. Refer
                        to the&nbsp;
                        <TextLink
                          href={
                            'https://grafana.com/docs/grafana/latest/administration/user-management/manage-org-users/#change-a-users-organization-permissions'
                          }
                          external
                        >
                          Grafana authentication docs
                        </TextLink>
                        &nbsp;for details.
                      </Trans>
                    </div>
                  }
                >
                  <Icon name="question-circle" />
                </Tooltip>
              </Box>
            )
          );
        },
      },
      {
        id: 'authLabels',
        header: 'Origin',
        cell: ({ cell: { value } }: Cell<'authLabels'>) => (
          <>{Array.isArray(value) && value.length > 0 && <TagBadge label={value[0]} removeIcon={false} count={0} />}</>
        ),
      },
      {
        id: 'isProvisioned',
        header: 'Provisioned',
        cell: ({ cell: { value } }: Cell<'isProvisioned'>) => (
          <>{value && <Tag colorIndex={14} name={'Provisioned'} />}</>
        ),
      },
      {
        id: 'isDisabled',
        header: '',
        cell: ({ cell: { value } }: Cell<'isDisabled'>) => <>{value && <Tag colorIndex={9} name={'Disabled'} />}</>,
      },
      {
        id: 'delete',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return (
            contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRemove, original) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setUserToRemove(original);
                }}
                icon="times"
                aria-label={t('admin.org-users-table.delete-aria-label', 'Delete user: {{name}}', {
                  name: original.name,
                })}
              />
            )
          );
        },
      },
    ],
    [rolesLoading, orgId, roleOptions, onUserRolesChange, onRoleChange]
  );

  return (
    <Stack direction={'column'} gap={2} data-testid={selectors.container}>
      <InteractiveTable columns={columns} data={users} getRowId={(user) => String(user.userId)} fetchData={fetchData} />
      <Stack justifyContent="flex-end">
        <Pagination onNavigate={changePage} currentPage={page} numberOfPages={totalPages} hideWhenSinglePage={true} />
      </Stack>
      {drawerUser && (
        <RolePickerDrawer
          onClose={() => setDrawerUserId(null)}
          entityName={drawerUser.name || drawerUser.login}
          appliedRoles={drawerUserRoles}
          roleOptions={drawerRoleOptions}
          teamRoles={teamRoles}
          basicRole={drawerUser.role}
          onBasicRoleChange={(newRole) => onRoleChange(newRole, drawerUser)}
          basicRoleDisabled={getBasicRoleDisabled(drawerUser)}
          basicRoleDisabledMessage={disabledRoleMessage}
          onSave={handleDrawerSave}
          canUpdateRoles={canUpdateRoles}
          advancedViewUrl={drawerUser.uid ? `/admin/users/roles/${drawerUser.uid}` : undefined}
        />
      )}
      {Boolean(userToRemove) && (
        <ConfirmModal
          body={t('admin.org-users-table.body-delete', 'Are you sure you want to delete user {{user}}?', {
            user: userToRemove?.login,
          })}
          confirmText={t('admin.org-users-table.confirmText-delete', 'Delete')}
          title={t('admin.org-users-table.title-delete', 'Delete')}
          onDismiss={() => {
            setUserToRemove(null);
          }}
          isOpen={true}
          onConfirm={() => {
            if (!userToRemove) {
              return;
            }
            onRemoveUser(userToRemove);
            setUserToRemove(null);
          }}
        />
      )}
    </Stack>
  );
};
