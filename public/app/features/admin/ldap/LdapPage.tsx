import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Button, Field, Form, Input, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  AppNotificationSeverity,
  LdapError,
  LdapUser,
  StoreState,
  SyncInfo,
  LdapConnectionInfo,
  AccessControlAction,
} from 'app/types';

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

interface State {
  isLoading: boolean;
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

export class LdapPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    const { clearUserMappingInfo, queryParams } = this.props;
    await clearUserMappingInfo();
    await this.fetchLDAPStatus();

    if (queryParams.username) {
      await this.fetchUserMapping(queryParams.username);
    }

    this.setState({ isLoading: false });
  }

  async fetchLDAPStatus() {
    const { loadLdapState, loadLdapSyncStatus } = this.props;
    return Promise.all([loadLdapState(), loadLdapSyncStatus()]);
  }

  async fetchUserMapping(username: string) {
    const { loadUserMapping } = this.props;
    return await loadUserMapping(username);
  }

  search = (username: string) => {
    if (username) {
      this.fetchUserMapping(username);
    }
  };

  onClearUserError = () => {
    this.props.clearUserError();
  };

  render() {
    const { ldapUser, userError, ldapError, ldapSyncInfo, ldapConnectionInfo, queryParams } = this.props;
    const { isLoading } = this.state;
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
                <h3>Test user mapping</h3>
                <Form onSubmit={(data: FormModel) => this.search(data.username)}>
                  {({ register }) => (
                    <Field label="Username">
                      <Input
                        {...register('username', { required: true })}
                        width={34}
                        id="username"
                        type="text"
                        defaultValue={queryParams.username}
                        addonAfter={
                          <Button variant="primary" type="submit">
                            Run
                          </Button>
                        }
                      />
                    </Field>
                  )}
                </Form>
                {userError && userError.title && (
                  <Alert
                    title={userError.title}
                    severity={AppNotificationSeverity.Error}
                    onRemove={this.onClearUserError}
                  >
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
  }
}

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
