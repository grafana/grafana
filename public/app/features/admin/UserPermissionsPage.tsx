import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Stack, Alert, Button, Modal, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

import { AddRoleModal } from './AddRoleModal';
import { OrgRolePicker } from './OrgRolePicker';
import { UserPermissionsTable } from './UserPermissionsTable';

interface UserProfile {
  id: number;
  uid: string;
  login: string;
  name: string;
  email: string;
}

export interface RoleWithOrg extends Role {
  orgId: number;
  orgName: string;
}

export default function UserPermissionsPage() {
  const { uid } = useParams<{ uid: string }>();
  const isEnterprise = contextSrv.licensedAccessControlEnabled();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<RoleWithOrg[]>([]);
  const [teams, setTeams] = useState<TeamWithRoles[]>([]);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OrgRole>(OrgRole.Viewer);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Get current organization from global context
  const currentOrgId = contextSrv.user.orgId;
  const currentOrgName = contextSrv.user.orgName;

  const canAddRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd);
  const canChangeOrgRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);

  // Show enterprise feature notice in OSS mode
  if (!isEnterprise) {
    const ossPageNav = {
      text: 'User Roles',
      url: `/admin/users/roles/${uid}`,
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      subTitle: 'Manage roles for users in your organization.',
    };

    return (
      <Page navId="global-users" pageNav={ossPageNav}>
        <Page.Contents>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <Alert severity="info" title="Enterprise Feature">
            Role management requires Grafana Enterprise with RBAC enabled. Contact your administrator or visit
            grafana.com to learn more about Grafana Enterprise.
          </Alert>
        </Page.Contents>
      </Page>
    );
  }

  const loadData = useCallback(async () => {
    if (!uid) {
      setError('User UID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First, fetch user profile and orgs
      const [userProfile, orgsData] = await Promise.all([
        getBackendSrv().get<UserProfile>(`/api/users/${uid}`),
        getBackendSrv().get<UserOrg[]>(`/api/users/${uid}/orgs`),
      ]);

      setUser(userProfile);
      setOrgs(orgsData);

      if (orgsData.length === 0) {
        setError('User is not a member of any organizations');
        setIsLoading(false);
        return;
      }

      // Fetch roles for EACH org in parallel
      const orgRolesPromises = orgsData.map(async (org) => {
        const rolesResponse = await getBackendSrv().post<Record<number, Role[]>>(
          '/api/access-control/users/roles/search',
          {
            userIds: [userProfile.id],
            orgId: org.orgId,
          }
        );

        // Tag each role with its orgId and orgName
        const rolesForOrg = rolesResponse[userProfile.id] || [];
        return rolesForOrg.map((role) => ({
          ...role,
          orgId: org.orgId,
          orgName: org.name,
        }));
      });

      // Fetch teams (contains all teams across orgs)
      const teamsDataPromise = getBackendSrv().get<TeamWithRoles[]>(`/api/users/${userProfile.id}/teams`);

      // Wait for all roles and teams
      const [allOrgRoles, teamsData] = await Promise.all([
        Promise.all(orgRolesPromises),
        teamsDataPromise,
      ]);

      // Flatten all roles from all orgs into single array
      const allRoles = allOrgRoles.flat();
      setRoles(allRoles);

      // Fetch team roles for each team, grouped by org
      const teamsWithRoles = await Promise.all(
        teamsData.map(async (team) => {
          try {
            const teamRoles = await getBackendSrv().get<Role[]>(
              `/api/access-control/teams/${team.id}/roles`,
              team.orgId ? { targetOrgId: team.orgId } : {}
            );
            return {
              ...team,
              roles: teamRoles.map((role) => ({
                ...role,
                orgId: team.orgId,
                orgName: orgsData.find((o) => o.orgId === team.orgId)?.name || 'Unknown',
              })),
            };
          } catch (err) {
            console.error(`Failed to fetch roles for team ${team.id}:`, err);
            return { ...team, roles: [] };
          }
        })
      );

      setTeams(teamsWithRoles);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading user permissions:', err);
      let errorMessage = 'Failed to load user permissions';
      if (err && typeof err === 'object') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const errorObj = err as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const data = errorObj.data as { message?: string } | undefined;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const message = errorObj.message as string | undefined;
        errorMessage = data?.message || message || errorMessage;
      }
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter roles to only show current org
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => role.orgId === currentOrgId);
  }, [roles, currentOrgId]);

  // Filter teams to only show current org
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => team.orgId === currentOrgId);
  }, [teams, currentOrgId]);

  // Get current role UIDs for current org (directly assigned only)
  const currentRoleUids = useMemo(() => {
    return filteredRoles.filter((role) => !role.mapped).map((role) => role.uid);
  }, [filteredRoles]);

  // Get all role UIDs (from any source: direct, team, org, external)
  const allAssignedRoleUids = useMemo(() => {
    const roleUids = new Set<string>();

    // Add directly assigned roles
    filteredRoles.forEach((role) => roleUids.add(role.uid));

    // Add roles from teams
    filteredTeams.forEach((team) => {
      team.roles?.forEach((role) => roleUids.add(role.uid));
    });

    return Array.from(roleUids);
  }, [filteredRoles, filteredTeams]);

  // Get current org object
  const currentOrg = useMemo(() => {
    return orgs.find((org) => org.orgId === currentOrgId);
  }, [orgs, currentOrgId]);

  const handleOpenChangeRoleModal = useCallback(() => {
    if (currentOrg) {
      setSelectedRole(currentOrg.role);
      setIsChangeRoleModalOpen(true);
    }
  }, [currentOrg]);

  const handleChangeRole = useCallback(async () => {
    if (!user || !currentOrg) {
      return;
    }

    try {
      setIsUpdatingRole(true);
      await getBackendSrv().patch(`/api/orgs/${currentOrgId}/users/${user.uid}`, {
        role: selectedRole,
      });
      setIsChangeRoleModalOpen(false);
      // Reload data to reflect changes
      loadData();
    } catch (err) {
      console.error('Error updating organization role:', err);
    } finally {
      setIsUpdatingRole(false);
    }
  }, [user, currentOrg, currentOrgId, selectedRole, loadData]);

  const pageNav = {
    text: 'Roles',
    url: `/admin/users/roles/${uid}`,
    subTitle:
      user && currentOrg
        ? orgs.length > 1
          ? `Manage roles for user ${user.login} in organization ${currentOrg.name}.`
          : `Manage roles for user ${user.login}.`
        : undefined,
    parentItem: user
      ? {
          text: user.login,
          url: `/admin/users/edit/${uid}`,
          parentItem: {
            text: 'Users',
            url: '/admin/users',
          },
        }
      : {
          text: 'Users',
          url: '/admin/users',
        },
  };

  return (
    <Page navId="global-users" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>
        {error && (
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          <Alert severity="error" title="Error loading permissions">
            {error}
          </Alert>
        )}
        {!isLoading && !error && user && (
          <Stack gap={1} direction="column">
            {currentOrg && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-48px', marginBottom: '16px', position: 'relative', zIndex: 10 }}>
                <Stack gap={1}>
                  {canChangeOrgRole && (
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    <Button variant="secondary" onClick={handleOpenChangeRoleModal}>
                      Change Basic Role
                    </Button>
                  )}
                  {canAddRoles && (
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    <Button variant="primary" icon="plus" onClick={() => setIsAddRoleModalOpen(true)}>
                      Add Role
                    </Button>
                  )}
                </Stack>
              </div>
            )}

            {!currentOrg && (
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              <Alert severity="warning" title={`User not part of the ${currentOrgName} organization`}>
                This user is not a member of the currently selected organization. Switch to an organization the user
                belongs to in order to manage their roles.
              </Alert>
            )}

            {currentOrg && (
              <>
                <UserPermissionsTable
                  roles={filteredRoles}
                  teams={filteredTeams}
                  orgs={[currentOrg]}
                  userId={user.id}
                  userName={user.login}
                  onRolesChanged={loadData}
                />

                {canAddRoles && (
                  <AddRoleModal
                    isOpen={isAddRoleModalOpen}
                    userId={user.id}
                    userUid={user.uid}
                    currentRoleUids={currentRoleUids}
                    allAssignedRoleUids={allAssignedRoleUids}
                    selectedOrgId={currentOrgId}
                    onDismiss={() => setIsAddRoleModalOpen(false)}
                    onRoleAdded={() => {
                      setIsAddRoleModalOpen(false);
                      loadData();
                    }}
                  />
                )}

                {canChangeOrgRole && (
                  <Modal
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    title="Change Basic Organization Role"
                    isOpen={isChangeRoleModalOpen}
                    onDismiss={() => setIsChangeRoleModalOpen(false)}
                  >
                    {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                    <Field label="Role" noMargin>
                      <OrgRolePicker
                        inputId="change-org-role"
                        value={selectedRole}
                        onChange={setSelectedRole}
                        autoFocus
                      />
                    </Field>
                    <Modal.ButtonRow>
                      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                      <Button variant="secondary" onClick={() => setIsChangeRoleModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="primary" onClick={handleChangeRole} disabled={isUpdatingRole}>
                        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                        {isUpdatingRole ? 'Saving...' : 'Save'}
                      </Button>
                    </Modal.ButtonRow>
                  </Modal>
                )}
              </>
            )}
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}
