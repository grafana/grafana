import React from 'react';
import { UserProvider } from 'app/core/utils/UserProvider';
import { UserProfileEditForm } from './UserProfileEditForm';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { UserTeams } from './UserTeams';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';

export const ReactProfileWrapper = () => (
  <UserProvider userId={config.bootData.user.id}>
    {(api, states, teams, user) => {
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
        </>
      );
    }}
  </UserProvider>
);

export default ReactProfileWrapper;
