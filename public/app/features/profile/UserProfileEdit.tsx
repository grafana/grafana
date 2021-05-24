import React from 'react';
import { useAsync } from 'react-use';
import { connect, ConnectedProps } from 'react-redux';
import { hot } from 'react-hot-loader';
import { NavModel } from '@grafana/data';
import { VerticalGroup } from '@grafana/ui';

import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import Page from 'app/core/components/Page/Page';
import {
  changeUserOrg,
  loadOrgs,
  loadSessions,
  loadTeams,
  loadUser,
  revokeUserSession,
  updateUserProfile,
} from './state/actions';
import UserProfileEditForm from './UserProfileEditForm';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { UserTeams } from './UserTeams';
import UserOrganizations from './UserOrganizations';
import UserSessions from './UserSessions';

export interface OwnProps {
  navModel: NavModel;
}

function mapStateToProps(state: StoreState) {
  const userState = state.user;
  const { user, teams, orgs, sessions, loadingTeams, loadingOrgs, loadingUser, loadingSessions, updating } = userState;
  return {
    navModel: getNavModel(state.navIndex, 'profile-settings'),
    loadingOrgs,
    loadingSessions,
    loadingTeams,
    loadingUser,
    orgs,
    sessions,
    teams,
    updating,
    user,
  };
}

const mapDispatchToProps = {
  loadUser,
  loadTeams,
  loadOrgs,
  loadSessions,
  revokeUserSession,
  changeUserOrg,
  updateUserProfile,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

export function UserProfileEdit({
  navModel,
  loadingOrgs,
  loadingSessions,
  loadingTeams,
  loadingUser,
  loadUser,
  loadTeams,
  loadOrgs,
  loadSessions,
  orgs,
  sessions,
  teams,
  updating,
  user,
  revokeUserSession,
  changeUserOrg,
  updateUserProfile,
}: Props) {
  useAsync(async () => {
    await loadUser();
    loadTeams();
    loadOrgs();
    loadSessions();
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loadingUser || !Boolean(user)}>
        <VerticalGroup spacing="md">
          <UserProfileEditForm updateProfile={updateUserProfile} isSavingUser={updating} user={user!} />
          <SharedPreferences resourceUri="user" />
          <UserTeams isLoading={loadingTeams} teams={teams} />
          <UserOrganizations isLoading={loadingOrgs} setUserOrg={changeUserOrg} orgs={orgs} user={user!} />
          <UserSessions
            isLoading={loadingSessions}
            revokeUserSession={revokeUserSession}
            sessions={sessions}
            user={user!}
          />
        </VerticalGroup>
      </Page.Contents>
    </Page>
  );
}

export default hot(module)(connector(UserProfileEdit));
