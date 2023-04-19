import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime/src';
import { useStyles2, TabsBar, Tab } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { Page } from '../../core/components/Page/Page';
import { AccessControlAction } from '../../types';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';
import { UserListPublicDashboardPage } from './UserListPublicDashboardPage';

enum TabView {
  ADMIN,
  ORG,
  PUBLIC_DASHBOARDS,
}

export default function UserListPage() {
  const styles = useStyles2(getStyles);

  const hasAccessToAdminUsers = contextSrv.hasAccess(AccessControlAction.UsersRead, contextSrv.isGrafanaAdmin);
  const hasAccessToOrgUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const hasEmailSharingEnabled =
    !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');

  const [view, setView] = useState(() => {
    if (hasAccessToAdminUsers) {
      return TabView.ADMIN;
    } else if (hasAccessToOrgUsers) {
      return TabView.ORG;
    }
    return null;
  });

  const showToggle = hasAccessToOrgUsers && hasAccessToAdminUsers;

  const renderTable = (): JSX.Element => {
    switch (view) {
      case TabView.ADMIN:
        return <UserListAdminPageContent />;
      case TabView.ORG:
        return <UsersListPageContent />;
      case TabView.PUBLIC_DASHBOARDS:
        return <UserListPublicDashboardPage />;
    }

    return <UsersListPageContent />;
  };

  return (
    <Page navId={'global-users'}>
      {showToggle ? (
        <TabsBar className={styles.tabsMargin}>
          <Tab label="All users" active={view === TabView.ADMIN} onChangeTab={() => setView(TabView.ADMIN)} />
          <Tab label="Organization users" active={view === TabView.ORG} onChangeTab={() => setView(TabView.ORG)} />
          {hasEmailSharingEnabled && (
            <Tab
              label="Public dashboard users"
              active={view === TabView.PUBLIC_DASHBOARDS}
              onChangeTab={() => setView(TabView.PUBLIC_DASHBOARDS)}
            />
          )}
        </TabsBar>
      ) : (
        hasEmailSharingEnabled && (
          <TabsBar className={styles.tabsMargin}>
            <Tab label="Users" active={view === null} onChangeTab={() => setView(null)} />
            <Tab
              label="Public dashboard users"
              active={view === TabView.PUBLIC_DASHBOARDS}
              onChangeTab={() => setView(TabView.PUBLIC_DASHBOARDS)}
            />
          </TabsBar>
        )
      )}
      {renderTable()}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsMargin: css({
    marginBottom: theme.spacing(3),
  }),
});
