import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { RadioButtonGroup, Field, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { Page } from '../../core/components/Page/Page';
import { AccessControlAction } from '../../types';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';

const views = [
  { value: 'admin', label: 'All organisations' },
  { value: 'org', label: 'This organisation' },
];

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
        <Field label={'Display list of users for'} className={styles.container}>
          <RadioButtonGroup options={views} onChange={setView} value={view} />
        </Field>
      )}
      {view === 'admin' ? <UserListAdminPageContent /> : <UsersListPageContent />}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin: ${theme.spacing(2, 0)};
    `,
  };
};
