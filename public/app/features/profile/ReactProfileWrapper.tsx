import React from 'react';
import { UserProvider } from 'app/core/utils/UserProvider';
import { UserProfileEditForm } from './UserProfileEditForm';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { config } from '@grafana/runtime';

export const ReactProfileWrapper = () => (
  <UserProvider userId={config.bootData.user.id}>
    {(api, states, user) => {
      return (
        <>
          {!states.loadUser && (
            <UserProfileEditForm
              updateProfile={api.updateUserProfile}
              isSavingUser={states.updateUserProfile}
              user={user}
            />
          )}
          <SharedPreferences resourceUri="user" />
        </>
      );
    }}
  </UserProvider>
);

export default ReactProfileWrapper;
