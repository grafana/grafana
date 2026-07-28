import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
import * as React from 'react';

import { type ComponentTypeWithExtensionMeta, type GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2, TabsBar, Tab } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { isEmailSharingEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { AccessControlAction } from 'app/types/accessControl';

import { Page } from '../../core/components/Page/Page';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';
import { UserListAnonymousDevicesPageContent } from './UserListAnonymousPage';
import { type UserListTab, type UserListTabExtensionProps, validateUserListTab } from './UserListPage.types';
import { UserListPublicDashboardPage } from './UserListPublicDashboardPage/UserListPublicDashboardPage';
import { useUserListTabExtensions } from './useUserListTabExtensions';

enum TabView {
  ACTIVE_USERS = 'active-users',
  ADMIN = 'admin',
  ORG = 'org',
  PUBLIC_DASHBOARDS = 'public-dashboards',
  ANON = 'anon',
}

type TabDef = {
  id: string;
  label: string;
  testId?: string;
  counter?: number;
  content: React.ReactElement;
};

const selectors = e2eSelectors.pages.UserListPage;

function UserListExtensionTab({
  Component,
  registerTab,
  activeTab,
}: {
  Component: ComponentTypeWithExtensionMeta<UserListTabExtensionProps>;
  registerTab: (tab: UserListTab) => () => void;
  activeTab: string;
}) {
  const [id, setId] = useState<string | null>(null);
  const register = useCallback(
    (tab: unknown) => {
      validateUserListTab(tab);

      setId(tab.id);
      const unregister = registerTab(tab);

      return () => {
        setId(null);
        unregister();
      };
    },
    [registerTab]
  );

  return <Component register={register} active={activeTab === id} />;
}

export default function UserListPage() {
  const styles = useStyles2(getStyles);

  const hasAccessToAdminUsers = contextSrv.hasPermission(AccessControlAction.UsersRead);
  const hasAccessToOrgUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const showAdminAndOrgTabs = hasAccessToOrgUsers && hasAccessToAdminUsers;

  const [view, setView] = useState<string>(() => {
    if (hasAccessToAdminUsers) {
      return TabView.ADMIN;
    } else if (hasAccessToOrgUsers) {
      return TabView.ORG;
    }
    return TabView.ACTIVE_USERS;
  });

  const [extensionTabs, setExtensionTabs] = useState<UserListTab[]>([]);

  const extensionComponents = useUserListTabExtensions();

  const registerTab = useCallback((tab: UserListTab) => {
    setExtensionTabs((prev) => [...prev, tab]);
    return () => setExtensionTabs((prev) => prev.filter((t) => t !== tab));
  }, []);

  const builtInTabs = useMemo<TabDef[]>(() => {
    const result: TabDef[] = [];

    if (showAdminAndOrgTabs) {
      result.push({
        id: TabView.ADMIN,
        label: t('admin.user-list-page.label-all-users', 'All users'),
        testId: selectors.tabs.allUsers,
        content: <UserListAdminPageContent />,
      });
      result.push({
        id: TabView.ORG,
        label: t('admin.user-list-page.label-organization-users', 'Organization users'),
        testId: selectors.tabs.orgUsers,
        content: <UsersListPageContent />,
      });
      if (config.anonymousEnabled) {
        result.push({
          id: TabView.ANON,
          label: t('admin.user-list-page.label-anonymous-devices', 'Anonymous devices'),
          testId: selectors.tabs.anonUserDevices,
          content: <UserListAnonymousDevicesPageContent />,
        });
      }
    } else if (isEmailSharingEnabled()) {
      result.push({
        id: TabView.ORG,
        label: t('admin.user-list-page.label-users', 'Users'),
        testId: selectors.tabs.users,
        content: <UsersListPageContent />,
      });
    } else {
      result.push({
        id: TabView.ACTIVE_USERS,
        label: t('admin.user-list-page.label-active-users', 'Active users'),
        content: <UsersListPageContent />,
      });
    }

    if (isEmailSharingEnabled()) {
      result.push({
        id: TabView.PUBLIC_DASHBOARDS,
        label: t('users-access-list.tabs.shared-dashboard-users-tab-title', 'Shared dashboard users'),
        testId: selectors.tabs.publicDashboardsUsers,
        content: <UserListPublicDashboardPage />,
      });
    }

    return result;
  }, [showAdminAndOrgTabs]);

  const allTabs = [...builtInTabs, ...extensionTabs];
  const activeTabId = allTabs.some((tab) => tab.id === view) ? view : (allTabs[0]?.id ?? '');

  return (
    <Page navId={'global-users'}>
      {allTabs.length > 1 && (
        <TabsBar className={styles.tabsMargin}>
          {allTabs.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              icon={'icon' in tab ? tab.icon : undefined}
              counter={tab.counter}
              active={activeTabId === tab.id}
              onChangeTab={() => setView(tab.id)}
              {...('testId' in tab && tab.testId ? { 'data-testid': tab.testId } : {})}
            />
          ))}
        </TabsBar>
      )}
      {builtInTabs.find((tab) => tab.id === activeTabId)?.content}
      {extensionComponents.map((Component, i) => (
        <UserListExtensionTab key={i} Component={Component} registerTab={registerTab} activeTab={activeTabId} />
      ))}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsMargin: css({
    marginBottom: theme.spacing(3),
  }),
});
