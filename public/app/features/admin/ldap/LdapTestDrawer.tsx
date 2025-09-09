import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Button, Drawer, Field, Input, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import { useDispatch, useSelector } from 'app/types/store';

import {
  loadLdapState,
  loadLdapSyncStatus,
  loadUserMapping,
  clearUserError,
  clearUserMappingInfo,
} from '../state/actions';

import { LdapConnectionStatus } from './LdapConnectionStatus';
import { LdapSyncInfo } from './LdapSyncInfo';
import { LdapUserInfo } from './LdapUserInfo';

interface Props {
  onClose: () => void;
  username?: string;
}

interface FormModel {
  username: string;
}

export const LdapTestDrawer = ({ onClose, username }: Props) => {
  const dispatch = useDispatch();

  const ldapConnectionInfo = useSelector((state) => state.ldap.connectionInfo);
  const ldapUser = useSelector((state) => state.ldap.user);
  const ldapSyncInfo = useSelector((state) => state.ldap.syncInfo);
  const userError = useSelector((state) => state.ldap.userError);
  const ldapError = useSelector((state) => state.ldap.ldapError);
  const { register, handleSubmit } = useForm<FormModel>();

  const fetchUserMapping = useCallback(
    async (username: string) => {
      return dispatch(loadUserMapping(username));
    },
    [dispatch]
  );

  useEffect(() => {
    const fetchLDAPStatus = async () => {
      return Promise.all([dispatch(loadLdapState()), dispatch(loadLdapSyncStatus())]);
    };

    async function init() {
      dispatch(clearUserMappingInfo());
      await fetchLDAPStatus();

      if (username) {
        await fetchUserMapping(username);
      }
    }

    init();
  }, [dispatch, fetchUserMapping, username]);

  const search = (data: FormModel, event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (data.username) {
      fetchUserMapping(data.username);
    }
  };

  const onClearUserError = () => {
    dispatch(clearUserError());
  };

  const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
  return (
    <Drawer
      title={t('admin.ldap.debug-title', 'LDAP Diagnostics')}
      subtitle={t('admin.ldap.debug-subtitle', 'Verify your LDAP and user mapping configuration.')}
      onClose={onClose}
    >
      <Stack direction="column" gap={4}>
        {ldapError && ldapError.title && (
          <Alert title={ldapError.title} severity={AppNotificationSeverity.Error}>
            {ldapError.body}
          </Alert>
        )}

        <LdapConnectionStatus ldapConnectionInfo={ldapConnectionInfo} />

        {featureEnabled('ldapsync') && ldapSyncInfo && <LdapSyncInfo ldapSyncInfo={ldapSyncInfo} />}

        {canReadLDAPUser && (
          <section>
            <h3>
              <Trans i18nKey="admin.ldap.test-mapping-heading">Test user mapping</Trans>
            </h3>
            <form onSubmit={handleSubmit(search)}>
              <Field label={t('admin.ldap-page.label-username', 'Username')}>
                <Input
                  {...register('username', { required: true })}
                  width={34}
                  id="username"
                  type="text"
                  defaultValue={username}
                  addonAfter={
                    <Button variant="primary" type="submit">
                      <Trans i18nKey="admin.ldap.test-mapping-run-button">Run</Trans>
                    </Button>
                  }
                />
              </Field>
            </form>
            {userError && userError.title && (
              <Alert title={userError.title} severity={AppNotificationSeverity.Error} onRemove={onClearUserError}>
                {userError.body}
              </Alert>
            )}
            {ldapUser && <LdapUserInfo ldapUser={ldapUser} />}
          </section>
        )}
      </Stack>
    </Drawer>
  );
};
