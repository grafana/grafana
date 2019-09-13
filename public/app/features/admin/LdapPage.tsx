import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { FormField } from '@grafana/ui';
import Page from '../../core/components/Page/Page';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
import { LdapConnectionStatus } from './LdapConnectionStatus';
import { LdapSyncInfo } from './LdapSyncInfo';
import config from '../../core/config';
import { getNavModel } from '../../core/selectors/navModel';
import { AppNotificationSeverity, LdapError, LdapUser, StoreState, SyncInfo, LdapConnectionInfo } from 'app/types';
import {
  loadLdapState,
  loadLdapSyncStatus,
  loadUserMapping,
  clearUserError,
  clearUserMappingInfo,
} from './state/actions';
import { LdapUserInfo } from './LdapUserInfo';

interface Props {
  navModel: NavModel;
  ldapConnectionInfo: LdapConnectionInfo;
  ldapUser: LdapUser;
  ldapSyncInfo: SyncInfo;
  ldapError: LdapError;
  userError?: LdapError;

  loadLdapState: typeof loadLdapState;
  loadLdapSyncStatus: typeof loadLdapSyncStatus;
  loadUserMapping: typeof loadUserMapping;
  clearUserError: typeof clearUserError;
  clearUserMappingInfo: typeof clearUserMappingInfo;
}

interface State {
  isLoading: boolean;
}

export class LdapPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    await this.props.clearUserMappingInfo();
    await this.fetchLDAPStatus();
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

  search = (event: any) => {
    event.preventDefault();
    const username = event.target.elements['username'].value;
    if (username) {
      this.fetchUserMapping(username);
    }
  };

  onClearUserError = () => {
    this.props.clearUserError();
  };

  render() {
    const { ldapUser, userError, ldapError, ldapSyncInfo, ldapConnectionInfo, navModel } = this.props;
    const { isLoading } = this.state;

    const tableStyle = css`
      margin-bottom: 48px;
    `;

    const headingStyle = css`
      margin-bottom: 24px;
    `;

    const searchStyle = css`
      margin-bottom: 16px;
    `;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <>
            {ldapError && ldapError.title && (
              <AlertBox title={ldapError.title} severity={AppNotificationSeverity.Error} body={ldapError.body} />
            )}

            <LdapConnectionStatus
              headingStyle={headingStyle}
              tableStyle={tableStyle}
              ldapConnectionInfo={ldapConnectionInfo}
            />

            {config.buildInfo.isEnterprise && ldapSyncInfo && (
              <LdapSyncInfo headingStyle={headingStyle} tableStyle={tableStyle} ldapSyncInfo={ldapSyncInfo} />
            )}

            <h4 className={headingStyle}>User mapping</h4>
            <form onSubmit={this.search} className={`${searchStyle} gf-form-inline`}>
              <FormField label="User name" labelWidth={8} inputWidth={30} type="text" id="username" name="username" />
              <button type="submit" className="btn btn-primary">
                Test LDAP mapping
              </button>
            </form>
            {userError && userError.title && (
              <AlertBox
                title={userError.title}
                severity={AppNotificationSeverity.Error}
                body={userError.body}
                onClose={this.onClearUserError}
              />
            )}
            {ldapUser && <LdapUserInfo className={tableStyle} ldapUser={ldapUser} showAttributeMapping={true} />}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'ldap'),
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

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapPage)
);
