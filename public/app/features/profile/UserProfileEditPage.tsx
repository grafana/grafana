import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { StoreState } from 'app/types';

import UserOrganizations from './UserOrganizations';
import UserProfileEditForm from './UserProfileEditForm';
import { UserProfileEditTabs } from './UserProfileEditTabs';
import UserSessions from './UserSessions';
import { UserTeams } from './UserTeams';
import { changeUserOrg, initUserProfilePage, revokeUserSession, updateUserProfile } from './state/actions';

export interface OwnProps {}

function mapStateToProps(state: StoreState) {
  const userState = state.user;
  const { user, teams, orgs, sessions, teamsAreLoading, orgsAreLoading, sessionsAreLoading, isUpdating } = userState;
  return {
    orgsAreLoading,
    sessionsAreLoading,
    teamsAreLoading,
    orgs,
    sessions,
    teams,
    isUpdating,
    user,
  };
}

const mapDispatchToProps = {
  initUserProfilePage,
  revokeUserSession,
  changeUserOrg,
  updateUserProfile,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export function UserProfileEditPage({
  orgsAreLoading,
  sessionsAreLoading,
  teamsAreLoading,
  initUserProfilePage,
  orgs,
  sessions,
  teams,
  isUpdating,
  user,
  revokeUserSession,
  changeUserOrg,
  updateUserProfile,
}: Props) {
  useMount(() => initUserProfilePage());

  const { components, isLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.UserProfileTab,
  });

  return (
    <Page navId="profile/settings">
      <Page.Contents isLoading={!user || isLoading}>
        <UserProfileEditTabs components={components}>
          <Stack direction="column" gap={2} data-testid="user-profile-edit-page">
            <UserProfileEditForm updateProfile={updateUserProfile} isSavingUser={isUpdating} user={user} />
            <SharedPreferences resourceUri="user" preferenceType="user" />
            <Stack direction="column" gap={6}>
              <UserTeams isLoading={teamsAreLoading} teams={teams} />
              <UserOrganizations isLoading={orgsAreLoading} setUserOrg={changeUserOrg} orgs={orgs} user={user} />
              <UserSessions isLoading={sessionsAreLoading} revokeUserSession={revokeUserSession} sessions={sessions} />
            </Stack>
          </Stack>
        </UserProfileEditTabs>
      </Page.Contents>
    </Page>
  );
}

export default connector(UserProfileEditPage);
