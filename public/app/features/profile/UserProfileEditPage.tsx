import React, { useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Tab, TabsBar, TabContent, VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { StoreState } from 'app/types';

import UserOrganizations from './UserOrganizations';
import UserProfileEditForm from './UserProfileEditForm';
import UserSessions from './UserSessions';
import { UserTeams } from './UserTeams';
import { changeUserOrg, initUserProfilePage, revokeUserSession, updateUserProfile } from './state/actions';

type TabType = {
  value: string;
  label: string;
};

const CORE_SETTINGS_TAB: TabType = {
  value: 'core_settings_tab',
  label: 'Core Settings',
};

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
  const [activeTab, setActiveTab] = useState<string>(CORE_SETTINGS_TAB.value);

  useMount(() => initUserProfilePage());

  const extensionComponents = useMemo(() => {
    const { extensions } = getPluginComponentExtensions({
      extensionPointId: PluginExtensionPoints.UserProfileSettings,
      context: {},
      /**
       * only allow one extension component per plugin for this particular extension point
       * this restriction makes it easier to group plugin settings into tabs
       */
      limitPerPlugin: 1,
    });

    return extensions;
  }, []);

  const showTabs = extensionComponents.length > 0;
  const tabs: TabType[] = [
    CORE_SETTINGS_TAB,
    ...extensionComponents.map(({ title }) => ({ value: title, label: title })),
  ];

  const UserProfile = () => (
    <>
      <UserProfileEditForm updateProfile={updateUserProfile} isSavingUser={isUpdating} user={user} />
      <SharedPreferences resourceUri="user" preferenceType="user" />
      <UserTeams isLoading={teamsAreLoading} teams={teams} />
      <UserOrganizations isLoading={orgsAreLoading} setUserOrg={changeUserOrg} orgs={orgs} user={user} />
      <UserSessions isLoading={sessionsAreLoading} revokeUserSession={revokeUserSession} sessions={sessions} />
    </>
  );

  return (
    <Page navId="profile/settings">
      <Page.Contents isLoading={!user}>
        <VerticalGroup spacing="md">
          {showTabs ? (
            <>
              <TabsBar>
                {tabs.map(({ value, label }) => (
                  <Tab key={value} label={label} active={activeTab === value} onChangeTab={() => setActiveTab(value)} />
                ))}
              </TabsBar>
              <TabContent>
                {activeTab === CORE_SETTINGS_TAB.value && <UserProfile />}
                {extensionComponents.map(({ component: Component, title }) => {
                  if (activeTab === title) {
                    return <Component key={title} />;
                  }
                  return null;
                })}
              </TabContent>
            </>
          ) : (
            <UserProfile />
          )}
        </VerticalGroup>
      </Page.Contents>
    </Page>
  );
}

export default connector(UserProfileEditPage);
