import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Button, Field, Input, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AccessControlAction } from 'app/types/accessControl';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import { LdapConnectionInfo, LdapUser, SyncInfo, LdapError } from 'app/types/ldap';
import { StoreState } from 'app/types/store';

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

interface OwnProps extends GrafanaRouteComponentProps<{}, { username?: string }> {
  ldapConnectionInfo: LdapConnectionInfo;
  ldapUser?: LdapUser;
  ldapSyncInfo?: SyncInfo;
  ldapError?: LdapError;
  userError?: LdapError;
}

interface FormModel {
  username: string;
}

const pageNav: NavModelItem = {
  text: 'LDAP',
  subTitle: `Verify your LDAP and user mapping configuration.`,
  icon: 'book',
  id: 'LDAP',
};

export const LdapPage = ({
  clearUserMappingInfo,
  queryParams,
  loadLdapState,
  loadLdapSyncStatus,
  loadUserMapping,
  clearUserError,
  ldapUser,
  userError,
  ldapError,
  ldapSyncInfo,
  ldapConnectionInfo,
}: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const { register, handleSubmit } = useForm<FormModel>();

  const fetchUserMapping = useCallback(
    async (username: string) => {
      return loadUserMapping(username);
    },
    [loadUserMapping]
  );

  useEffect(() => {
    const fetchLDAPStatus = async () => {
      return Promise.all([loadLdapState(), loadLdapSyncStatus()]);
    };

    async function init() {
      await clearUserMappingInfo();
      await fetchLDAPStatus();

      if (queryParams.username) {
        await fetchUserMapping(queryParams.username);
      }

      setIsLoading(false);
    }

    init();
  }, [clearUserMappingInfo, fetchUserMapping, loadLdapState, loadLdapSyncStatus, queryParams]);

  const search = ({ username }: FormModel) => {
    if (username) {
      fetchUserMapping(username);
    }
  };

  const onClearUserError = () => {
    clearUserError();
  };

  const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
  return (
    <Page navId="authentication" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>
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
                    defaultValue={queryParams.username}
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
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  ldapConnectionInfo: state.ldap.connectionInfo,
  ldapUser: state.ldap.user,
  ldapSyncInfo: state.ldap.syncInfo,
  userError: state.ldap.userError,
  ldapError: state.ldap.ldapError,
});

const mapDispatchToProps = {
  loadLdapState,
  loadLdapSyncStatus,
  loadUserMapping,
  clearUserError,
  clearUserMappingInfo,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

export default connector(LdapPage);
