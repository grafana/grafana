import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, Tab } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { Page } from '../../core/components/Page/Page';
import { AccessControlAction } from '../../types';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';

export default function UserListPage() {
  const hasAccessToAdminUsers = contextSrv.hasAccess(AccessControlAction.UsersRead, contextSrv.isGrafanaAdmin);
  const hasAccessToOrgUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const styles = useStyles2(getStyles);
  const [view, setView] = useState(() => {
    if (hasAccessToAdminUsers) {
      return 'admin';
    } else if (hasAccessToOrgUsers) {
      return 'org';
    }
    return null;
  });

  const showToggle = hasAccessToOrgUsers && hasAccessToAdminUsers;

  return (
    <Page navId={'global-users'}>
      {showToggle && (
        <TabsBar className={styles.tabsMargin}>
          <Tab label="All users" active={view === 'admin'} onChangeTab={() => setView('admin')} />
          <Tab label="Organization users" active={view === 'org'} onChangeTab={() => setView('org')} />
        </TabsBar>
      )}
      {view === 'admin' ? <UserListAdminPageContent /> : <UsersListPageContent />}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsMargin: css({
    marginBottom: theme.spacing(3),
  }),
});
