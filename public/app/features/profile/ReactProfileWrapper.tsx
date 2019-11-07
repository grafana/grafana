import React from 'react';
import { UserProvider } from 'app/core/utils/UserProvider';
import { UserProfileEditForm } from './UserProfileEditForm';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { UserTeams } from './UserTeams';
import { UserOrganizations } from './UserOrganizations';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';

export const ReactProfileWrapper = () => (
  <UserProvider userId={config.bootData.user.id}>
    {(api, states, teams, orgs, user) => {
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
            <UserOrganizations
              isLoading={states.loadOrgs}
              setUserOrg={api.setUserOrg}
              loadOrgs={api.loadOrgs}
              orgs={orgs}
              user={user}
            />
          )}
        </>
      );
    }}
  </UserProvider>
);

export default ReactProfileWrapper;
