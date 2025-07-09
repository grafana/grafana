import { css } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
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
import { UserListPublicDashboardPage } from './UserListPublicDashboardPage/UserListPublicDashboardPage';

enum TabView {
  ADMIN = 'admin',
  ORG = 'org',
  PUBLIC_DASHBOARDS = 'public-dashboards',
  ANON = 'anon',
}

const selectors = e2eSelectors.pages.UserListPage;

const PublicDashboardsTab = ({ view, setView }: { view: TabView | null; setView: (v: TabView | null) => void }) => {
  return (
    <Tab
      label={
        config.featureToggles.newDashboardSharingComponent
          ? t('users-access-list.tabs.shared-dashboard-users-tab-title', 'Shared dashboard users')
          : t('users-access-list.tabs.public-dashboard-users-tab-title', 'Public dashboard users')
      }
      active={view === TabView.PUBLIC_DASHBOARDS}
      onChangeTab={() => setView(TabView.PUBLIC_DASHBOARDS)}
      data-testid={selectors.tabs.publicDashboardsUsers}
    />
  );
};

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
            label={t('admin.user-list-page.label-all-users', 'All users')}
            active={view === TabView.ADMIN}
            onChangeTab={() => setView(TabView.ADMIN)}
            data-testid={selectors.tabs.allUsers}
          />
          <Tab
            label={t('admin.user-list-page.label-organization-users', 'Organization users')}
            active={view === TabView.ORG}
            onChangeTab={() => setView(TabView.ORG)}
            data-testid={selectors.tabs.orgUsers}
          />
          {config.anonymousEnabled && (
            <Tab
              label={t('admin.user-list-page.label-anonymous-devices', 'Anonymous devices')}
              active={view === TabView.ANON}
              onChangeTab={() => setView(TabView.ANON)}
              data-testid={selectors.tabs.anonUserDevices}
            />
          )}
          {isEmailSharingEnabled() && <PublicDashboardsTab view={view} setView={setView} />}
        </TabsBar>
      ) : (
        isEmailSharingEnabled() && (
          <TabsBar className={styles.tabsMargin}>
            <Tab
              label={t('admin.user-list-page.label-users', 'Users')}
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
