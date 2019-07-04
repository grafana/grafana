import React, { PureComponent } from 'react';
import { UserProvider } from 'app/core/utils/UserProvider';
import { UserProfileEditForm } from './UserProfileEditForm';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';

export class ReactProfileWrapper extends PureComponent {
  render() {
    return (
      <UserProvider loadUser={true}>
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
  }
}

export default ReactProfileWrapper;
