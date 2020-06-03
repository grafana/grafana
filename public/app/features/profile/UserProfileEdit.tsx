import React, { FC } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { LoadingPlaceholder } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { NavModel } from '@grafana/data';
import { UserProvider, UserAPI, LoadingStates } from 'app/core/utils/UserProvider';
import { getNavModel } from 'app/core/selectors/navModel';
import { User, Team, UserOrg, UserSession, StoreState } from 'app/types';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import Page from 'app/core/components/Page/Page';
import { UserTeams } from './UserTeams';
import { UserSessions } from './UserSessions';
import { UserOrganizations } from './UserOrganizations';
import { UserProfileEditForm } from './UserProfileEditForm';

export interface Props {
  navModel: NavModel;
}

export const UserProfileEdit: FC<Props> = ({ navModel }) => (
  <Page navModel={navModel}>
    <UserProvider userId={config.bootData.user.id}>
      {(api: UserAPI, states: LoadingStates, teams: Team[], orgs: UserOrg[], sessions: UserSession[], user: User) => {
        return (
          <Page.Contents>
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
          </Page.Contents>
        );
      }}
    </UserProvider>
  </Page>
);

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'profile-settings'),
  };
}

export default hot(module)(connect(mapStateToProps, null)(UserProfileEdit));
