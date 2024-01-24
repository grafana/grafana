import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, featureEnabled } from '@grafana/runtime';
import { useStyles2, TabsBar, Tab } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { Page } from '../../core/components/Page/Page';
import { AccessControlAction } from '../../types';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';
import { UserListAnonymousDevicesPageContent } from './UserListAnonymousPage';
import { UserListPublicDashboardPage } from './UserListPublicDashboardPage/UserListPublicDashboardPage';

enum TabView {
  ADMIN = 'admin',
  ORG = 'org',
  PUBLIC_DASHBOARDS = 'public-dashboards',
  ANON = 'anon',
}

const selectors = e2eSelectors.pages.UserListPage;

const PublicDashboardsTab = ({ view, setView }: { view: TabView | null; setView: (v: TabView | null) => void }) => (
  <Tab
    label={t('users-access-list.tabs.public-dashboard-users-tab-title', 'Public dashboard users')}
    active={view === TabView.PUBLIC_DASHBOARDS}
    onChangeTab={() => setView(TabView.PUBLIC_DASHBOARDS)}
    data-testid={selectors.tabs.publicDashboardsUsers}
  />
);

const TAB_PAGE_MAP: Record<TabView, React.ReactElement> = {
  [TabView.ADMIN]: <UserListAdminPageContent />,
  [TabView.ORG]: <UsersListPageContent />,
  [TabView.PUBLIC_DASHBOARDS]: <UserListPublicDashboardPage />,
  [TabView.ANON]: <UserListAnonymousDevicesPageContent />,
};

export default function UserListPage() {
  const styles = useStyles2(getStyles);

  const hasAccessToAdminUsers = contextSrv.hasPermission(AccessControlAction.UsersRead);
  const hasAccessToOrgUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const hasEmailSharingEnabled =
    isPublicDashboardsEnabled() &&
    Boolean(config.featureToggles.publicDashboardsEmailSharing) &&
    featureEnabled('publicDashboardsEmailSharing');

  const [view, setView] = useState(() => {
    if (hasAccessToAdminUsers) {
      return TabView.ADMIN;
    } else if (hasAccessToOrgUsers) {
      return TabView.ORG;
    }
    return null;
  });

  const showAdminAndOrgTabs = hasAccessToOrgUsers && hasAccessToAdminUsers;

  return (
    <Page navId={'global-users'}>
      {showAdminAndOrgTabs ? (
        <TabsBar className={styles.tabsMargin}>
          <Tab
            label="All users"
            active={view === TabView.ADMIN}
            onChangeTab={() => setView(TabView.ADMIN)}
            data-testid={selectors.tabs.allUsers}
          />
          <Tab
            label="Organization users"
            active={view === TabView.ORG}
            onChangeTab={() => setView(TabView.ORG)}
            data-testid={selectors.tabs.orgUsers}
          />
          {config.anonymousEnabled && config.featureToggles.displayAnonymousStats && (
            <Tab
              label="Anonymous devices"
              active={view === TabView.ANON}
              onChangeTab={() => setView(TabView.ANON)}
              data-testid={selectors.tabs.anonUserDevices}
            />
          )}
          {hasEmailSharingEnabled && <PublicDashboardsTab view={view} setView={setView} />}
        </TabsBar>
      ) : (
        hasEmailSharingEnabled && (
          <TabsBar className={styles.tabsMargin}>
            <Tab
              label="Users"
              active={view === TabView.ORG}
              onChangeTab={() => setView(TabView.ORG)}
              data-testid={selectors.tabs.users}
            />
            <PublicDashboardsTab view={view} setView={setView} />
          </TabsBar>
        )
      )}
      {view ? TAB_PAGE_MAP[view] : <UsersListPageContent />}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsMargin: css({
    marginBottom: theme.spacing(3),
  }),
});
