import React, { FC, useCallback, useEffect, useMemo } from 'react';

import { LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { loadUsers } from 'app/features/users/state/actions';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { fetchRolesAction } from 'app/percona/shared/core/reducers/roles/roles';
import { fetchUsersListAction } from 'app/percona/shared/core/reducers/users/users';
import { getPerconaSettings, getAccessRoles, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from './AccessRole.messages';
import { getStyles } from './AccessRole.styles';
import { toAccessRoleRow, orderRole } from './AccessRole.utils';
import AccessRolesTable from './components/AccessRolesTable/AccessRolesTable';

const AccessRolesPage: FC<React.PropsWithChildren<unknown>> = () => {
  const dispatch = useAppDispatch();
  const { result: settings } = useSelector(getPerconaSettings);
  const { isLoading, roles } = useSelector(getAccessRoles);
  const rows = useMemo(
    // show default role first
    () => roles.map((role) => toAccessRoleRow(role, settings?.defaultRoleId)).sort(orderRole),
    [roles, settings?.defaultRoleId]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('enableAccessControl'), []);

  const styles = useStyles2(getStyles);

  useEffect(() => {
    dispatch(fetchRolesAction());
    dispatch(fetchUsersListAction());
    dispatch(loadUsers());
  }, [dispatch]);

  return (
    <Page navId="rbac-roles">
      <Page.Contents isLoading={isLoading}>
        <FeatureLoader featureSelector={featureSelector}>
          <h2 data-testid="access-roles-title">{Messages.title}</h2>
          <p className={styles.description}>
            {Messages.subtitle.text}
            {Messages.subtitle.further}
            <a
              className={styles.link}
              target="_blank"
              rel="noreferrer noopener"
              href="https://per.co.na/roles_permissions"
            >
              {Messages.subtitle.link}
            </a>
            {Messages.subtitle.dot}
          </p>
          <div className={styles.createContainer}>
            <LinkButton href="/roles/create" size="md" variant="primary" data-testid="access-roles-create-role">
              {Messages.create}
            </LinkButton>
          </div>
          <AccessRolesTable items={rows} />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default AccessRolesPage;
