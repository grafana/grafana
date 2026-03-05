import { createSelector } from '@reduxjs/toolkit';
import React, { memo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { Role } from 'app/types/accessControl';
import { StoreState, useDispatch, useSelector } from 'app/types/store';
import { TeamWithRoles } from 'app/types/teams';
import { UserDTO, UserOrg } from 'app/types/user';

import { UserInformationPage } from './UserInformationPage';
import type { RoleWithOrg } from './UserPermissionsPage';
import { UserRolesPage } from './UserRolesPage';
import { deleteUser, loadAdminUserPage } from './state/actions';
import { buildUserNavModel } from './state/buildUserNavModel';

type UserPageRouteParams = {
  uid: string;
  page?: string;
};

enum PageTypes {
  Information = 'information',
  Roles = 'roles',
}

function getPageType(page: string | undefined): PageTypes {
  switch (page) {
    case PageTypes.Roles:
      return PageTypes.Roles;
    case PageTypes.Information:
    default:
      return PageTypes.Information;
  }
}

// Create a loading nav model for when user is not yet loaded
function getLoadingNavModel(uid: string): NavModel {
  const navModel = buildUserNavModel(null, uid);
  return {
    main: navModel,
    node: navModel,
  };
}

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (state: StoreState) => state.userAdmin.user,
    (_state: StoreState, uid: string) => uid,
    (_state: StoreState, _uid: string, currentPage: PageTypes) => currentPage,
  ],
  (navIndex, user, uid, currentPage) => {
    if (!user) {
      return getLoadingNavModel(uid);
    }

    const navModel = buildUserNavModel(user, uid);
    const activeTab = navModel.children?.find((child) => child.id === `user-${currentPage}-${uid}`);

    if (activeTab) {
      activeTab.active = true;
    }

    return getNavModel(navIndex, `user-${currentPage}-${uid}`, {
      main: navModel,
      node: activeTab || navModel,
    });
  }
);

const UserPages = memo(() => {
  const dispatch = useDispatch();
  const { uid = '', page } = useParams<UserPageRouteParams>();

  const user = useSelector((state) => state.userAdmin.user);
  const isLoading = useSelector((state) => state.userAdmin.isLoading);
  const currentPage = getPageType(page);
  const pageNav = useSelector((state) => pageNavSelector(state, uid, currentPage));

  useEffect(() => {
    dispatch(loadAdminUserPage(uid));
  }, [dispatch, uid]);

  const handleUserDelete = useCallback(
    (userUid: string) => {
      dispatch(deleteUser(userUid));
    },
    [dispatch]
  );

  const renderPage = () => {
    if (!user) {
      return null;
    }

    switch (currentPage) {
      case PageTypes.Information:
        return <UserInformationPage user={user} onUserDelete={handleUserDelete} />;
      case PageTypes.Roles:
        return <UserRolesPageWrapper user={user} />;
      default:
        return <UserInformationPage user={user} onUserDelete={handleUserDelete} />;
    }
  };

  return (
    <Page navId="global-users" pageNav={pageNav.main}>
      <Page.Contents isLoading={isLoading}>{user && renderPage()}</Page.Contents>
    </Page>
  );
});

UserPages.displayName = 'UserPages';

// Wrapper component to fetch roles and teams data for UserRolesPage
const UserRolesPageWrapper = ({ user }: { user: UserDTO }) => {
  const [roles, setRoles] = React.useState<RoleWithOrg[]>([]);
  const [teams, setTeams] = React.useState<TeamWithRoles[]>([]);
  const [orgs, setOrgs] = React.useState<UserOrg[]>([]);

  const loadRolesData = useCallback(async () => {
    try {

      // Fetch orgs
      const orgsData = await getBackendSrv().get<UserOrg[]>(`/api/users/${user.uid}/orgs`);
      setOrgs(orgsData);

      if (orgsData.length === 0) {
        return;
      }

      // Fetch roles for EACH org in parallel
      const orgRolesPromises = orgsData.map(async (org) => {
        const rolesResponse = await getBackendSrv().post<Record<number, Role[]>>(
          '/api/access-control/users/roles/search',
          {
            userIds: [user.id],
            orgId: org.orgId,
          }
        );

        // Tag each role with its orgId and orgName
        const rolesForOrg = rolesResponse[user.id] || [];
        return rolesForOrg.map((role) => ({
          ...role,
          orgId: org.orgId,
          orgName: org.name,
        }));
      });

      // Fetch teams
      const teamsDataPromise = getBackendSrv().get<TeamWithRoles[]>(`/api/users/${user.id}/teams`);

      // Wait for all roles and teams
      const [allOrgRoles, teamsData] = await Promise.all([Promise.all(orgRolesPromises), teamsDataPromise]);

      // Flatten all roles from all orgs into single array
      const allRoles = allOrgRoles.flat();
      setRoles(allRoles);

      // Fetch team roles for each team
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
    } catch (err) {
      console.error('Error loading roles data:', err);
    }
  }, [user]);

  React.useEffect(() => {
    loadRolesData();
  }, [loadRolesData]);

  return <UserRolesPage user={user} roles={roles} teams={teams} orgs={orgs} onRolesChanged={loadRolesData} />;
};

export default UserPages;
