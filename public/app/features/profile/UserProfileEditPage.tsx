import { keys, toPairs } from 'lodash';
import React, { useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { PluginExtensionComponent, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
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

const CORE_SETTINGS_TAB = 'Core';

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
  /**
   * TODO: a nice thing to have would be the ability to read the active tab initial state from a URL
   * query param. This would allow users to link to a specific tab in the user profile page.
   */
  const [activeTab, setActiveTab] = useState<string>(CORE_SETTINGS_TAB);

  useMount(() => initUserProfilePage());

  const extensionComponents = useMemo(() => {
    const { extensions } = getPluginComponentExtensions({
      extensionPointId: PluginExtensionPoints.UserProfileSettings,
      context: {},
    });

    return extensions;
  }, []);

  const groupedExtensionComponents = extensionComponents.reduce<Record<string, PluginExtensionComponent[]>>(
    (acc, extension) => {
      const { title } = extension;
      if (acc[title]) {
        acc[title].push(extension);
      } else {
        acc[title] = [extension];
      }
      return acc;
    },
    {}
  );

  const showTabs = extensionComponents.length > 0;
  const tabs = [CORE_SETTINGS_TAB, ...keys(groupedExtensionComponents).map((title) => title)];

  const UserProfile = () => (
    <VerticalGroup spacing="md">
      <UserProfileEditForm updateProfile={updateUserProfile} isSavingUser={isUpdating} user={user} />
      <SharedPreferences resourceUri="user" preferenceType="user" />
      <UserTeams isLoading={teamsAreLoading} teams={teams} />
      <UserOrganizations isLoading={orgsAreLoading} setUserOrg={changeUserOrg} orgs={orgs} user={user} />
      <UserSessions isLoading={sessionsAreLoading} revokeUserSession={revokeUserSession} sessions={sessions} />
    </VerticalGroup>
  );

  const UserProfileWithTabs = () => (
    <div data-testid={selectors.components.UserProfile.extensionPointTabs}>
      <VerticalGroup spacing="md">
        <TabsBar>
          {tabs.map((tabTitle) => (
            <Tab
              key={tabTitle}
              label={tabTitle}
              active={activeTab === tabTitle}
              onChangeTab={() => setActiveTab(tabTitle)}
              data-testid={selectors.components.UserProfile.extensionPointTab(tabTitle)}
            />
          ))}
        </TabsBar>
        <TabContent>
          {activeTab === CORE_SETTINGS_TAB && <UserProfile />}
          {toPairs(groupedExtensionComponents).map(([title, pluginExtensionComponents]) => {
            if (activeTab === title) {
              return (
                <React.Fragment key={title}>
                  {pluginExtensionComponents.map(({ component: Component }, index) => (
                    <Component key={`${title}-${index}`} />
                  ))}
                </React.Fragment>
              );
            }
            return null;
          })}
        </TabContent>
      </VerticalGroup>
    </div>
  );

  return (
    <Page navId="profile/settings">
      <Page.Contents isLoading={!user}>{showTabs ? <UserProfileWithTabs /> : <UserProfile />}</Page.Contents>
    </Page>
  );
}

export default connector(UserProfileEditPage);
