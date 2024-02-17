import React, { useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { PluginExtensionComponent, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Tab, TabsBar, TabContent, VerticalGroup, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t } from 'app/core/internationalization';
import { StoreState } from 'app/types';

import UserOrganizations from './UserOrganizations';
import UserProfileEditForm from './UserProfileEditForm';
import UserSessions from './UserSessions';
import { UserTeams } from './UserTeams';
import { changeUserOrg, initUserProfilePage, revokeUserSession, updateUserProfile } from './state/actions';

const TAB_QUERY_PARAM = 'tab';
const GENERAL_SETTINGS_TAB = 'general';

type TabInfo = {
  id: string;
  title: string;
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
  const [queryParams, updateQueryParams] = useQueryParams();
  const tabQueryParam = queryParams[TAB_QUERY_PARAM];
  const [activeTab, setActiveTab] = useState<string>(
    typeof tabQueryParam === 'string' ? tabQueryParam : GENERAL_SETTINGS_TAB
  );

  useMount(() => initUserProfilePage());

  const extensionComponents = useMemo(() => {
    const { extensions } = getPluginComponentExtensions({
      extensionPointId: PluginExtensionPoints.UserProfileTab,
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

  const convertExtensionComponentTitleToTabId = (title: string) => title.toLowerCase();

  const showTabs = extensionComponents.length > 0;
  const tabs: TabInfo[] = [
    {
      id: GENERAL_SETTINGS_TAB,
      title: t('user-profile.tabs.general', 'General'),
    },
    ...Object.keys(groupedExtensionComponents).map((title) => ({
      id: convertExtensionComponentTitleToTabId(title),
      title,
    })),
  ];

  const UserProfile = () => (
    <VerticalGroup spacing="md">
      <UserProfileEditForm updateProfile={updateUserProfile} isSavingUser={isUpdating} user={user} />
      <SharedPreferences resourceUri="user" preferenceType="user" />
      <Stack direction="column" gap={6}>
        <UserTeams isLoading={teamsAreLoading} teams={teams} />
        <UserOrganizations isLoading={orgsAreLoading} setUserOrg={changeUserOrg} orgs={orgs} user={user} />
        <UserSessions isLoading={sessionsAreLoading} revokeUserSession={revokeUserSession} sessions={sessions} />
      </Stack>
    </VerticalGroup>
  );

  const UserProfileWithTabs = () => (
    <div data-testid={selectors.components.UserProfile.extensionPointTabs}>
      <Stack direction="column" gap={2}>
        <TabsBar>
          {tabs.map(({ id, title }) => {
            return (
              <Tab
                key={id}
                label={title}
                active={activeTab === id}
                onChangeTab={() => {
                  setActiveTab(id);
                  updateQueryParams({ [TAB_QUERY_PARAM]: id });
                }}
                data-testid={selectors.components.UserProfile.extensionPointTab(id)}
              />
            );
          })}
        </TabsBar>
        <TabContent>
          {activeTab === GENERAL_SETTINGS_TAB && <UserProfile />}
          {Object.entries(groupedExtensionComponents).map(([title, pluginExtensionComponents]) => {
            const tabId = convertExtensionComponentTitleToTabId(title);

            if (activeTab === tabId) {
              return (
                <React.Fragment key={tabId}>
                  {pluginExtensionComponents.map(({ component: Component }, index) => (
                    <Component key={`${tabId}-${index}`} />
                  ))}
                </React.Fragment>
              );
            }
            return null;
          })}
        </TabContent>
      </Stack>
    </div>
  );

  return (
    <Page navId="profile/settings">
      <Page.Contents isLoading={!user}>{showTabs ? <UserProfileWithTabs /> : <UserProfile />}</Page.Contents>
    </Page>
  );
}

export default connector(UserProfileEditPage);
