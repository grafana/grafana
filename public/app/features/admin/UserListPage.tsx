import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { RadioButtonGroup, Field, useStyles2 } from '@grafana/ui';

import { Page } from '../../core/components/Page/Page';
import { UsersListPageContent } from '../users/UsersListPage';

import { UserListAdminPageContent } from './UserListAdminPage';

const views = [
  { value: 'admin', label: 'All organisations' },
  { value: 'org', label: 'This organisation' },
];
export function UserListPage() {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState('admin');

  return (
    <Page navId={'global-users'}>
      <Field label={'Display list of users for'} className={styles.container}>
        <RadioButtonGroup options={views} onChange={setView} value={view} />
      </Field>
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
