import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { getBackendSrv } from '@grafana/runtime';
import { Stack, LinkButton, Alert, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserOrg } from 'app/types/user';

import { AddRoleModal } from './AddRoleModal';
import { UserPermissionsTable } from './UserPermissionsTable';

interface UserProfile {
  id: number;
  uid: string;
  login: string;
  name: string;
  email: string;
}

export default function UserPermissionsPage() {
  const { uid } = useParams<{ uid: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<TeamWithRoles[]>([]);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  const canAddRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd);

  const loadData = useCallback(async () => {
    if (!uid) {
      setError('User UID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First, fetch user profile to get userId
      const userProfile = await getBackendSrv().get<UserProfile>(`/api/users/${uid}`);
      setUser(userProfile);

      // Then fetch all other data in parallel
      const [rolesResponse, teamsData, orgsData] = await Promise.all([
        getBackendSrv().post<Record<number, Role[]>>('/api/access-control/users/roles/search', {
          userIds: [userProfile.id],
          orgId: null, // Get roles from all orgs
        }),
        getBackendSrv().get<TeamWithRoles[]>(`/api/users/${userProfile.id}/teams`),
        getBackendSrv().get<UserOrg[]>(`/api/users/${uid}/orgs`),
      ]);

      setRoles(rolesResponse[userProfile.id] || []);
      setOrgs(orgsData);

      // Fetch roles for each team
      const teamsWithRoles = await Promise.all(
        teamsData.map(async (team) => {
          try {
            const teamRoles = await getBackendSrv().get<Role[]>(`/api/access-control/teams/${team.id}/roles`);
            return { ...team, roles: teamRoles };
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

  return (
    <Page
      navId="global-users"
      pageNav={{
        text: user?.login ? `Roles for ${user.login}` : 'User Roles',
        url: `/admin/users/roles/${uid}`,
      }}
    >
      <Page.Contents isLoading={isLoading}>
        {error && (
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          <Alert severity="error" title="Error loading permissions">
            {error}
          </Alert>
        )}
        {!isLoading && !error && user && (
          <Stack gap={1} direction="column">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
              <LinkButton href={`/admin/users/edit/${user.id}`} variant="secondary" size="sm">
                ← Back to User
              </LinkButton>
              {canAddRoles && (
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                <Button variant="primary" icon="plus" onClick={() => setIsAddRoleModalOpen(true)}>
                  Add Role
                </Button>
              )}
            </div>

            <UserPermissionsTable
              roles={roles}
              teams={teams}
              orgs={orgs}
              userId={user.id}
              userName={user.login}
              onRolesChanged={loadData}
            />

            {canAddRoles && (
              <AddRoleModal
                isOpen={isAddRoleModalOpen}
                userId={user.id}
                userUid={user.uid}
                currentRoleUids={roles.map((r) => r.uid)}
                onDismiss={() => setIsAddRoleModalOpen(false)}
                onRoleAdded={() => {
                  setIsAddRoleModalOpen(false);
                  loadData();
                }}
              />
            )}
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}
