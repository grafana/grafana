import React from 'react';
import { UserProvider, UserAPI, LoadingStates } from 'app/core/utils/UserProvider';
import { UserProfileEditForm } from './UserProfileEditForm';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { UserTeams } from './UserTeams';
import { UserSessions } from './UserSessions';
import { UserOrganizations } from './UserOrganizations';
import { User, Team, UserOrg, UserSession } from 'app/types';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';

export const UserProfileEdit = () => (
  <UserProvider userId={config.bootData.user.id}>
    {(api: UserAPI, states: LoadingStates, teams: Team[], orgs: UserOrg[], sessions: UserSession[], user: User) => {
      return (
        <>
          {states.loadUser ? (
            <LoadingPlaceholder text="Loading user profile..." />
          ) : (
            <UserProfileEditForm
              updateProfile={api.updateUserProfile}
              isSavingUser={states.updateUserProfile}
              user={user}
            />
          )}
          <SharedPreferences resourceUri="user" />
          <UserTeams isLoading={states.loadTeams} loadTeams={api.loadTeams} teams={teams} />
          {!states.loadUser && (
            <>
              <UserOrganizations
                isLoading={states.loadOrgs}
                setUserOrg={api.setUserOrg}
                loadOrgs={api.loadOrgs}
                orgs={orgs}
                user={user}
              />
              <UserSessions
                isLoading={states.loadSessions}
                loadSessions={api.loadSessions}
                revokeUserSession={api.revokeUserSession}
                sessions={sessions}
                user={user}
              />
            </>
          )}
        </>
      );
    }}
  </UserProvider>
);

export default UserProfileEdit;
