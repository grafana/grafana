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
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserTeams } from './LdapUserTeams';
import config from '../../core/config';
import { getNavModel } from '../../core/selectors/navModel';
import { AppNotificationSeverity, LdapError, LdapUser, StoreState, SyncInfo, LdapConnectionInfo } from 'app/types';
import { loadLdapState, loadUserMapping, clearUserError } from './state/actions';

interface Props {
  navModel: NavModel;
  ldapConnectionInfo: LdapConnectionInfo;
  ldapUser: LdapUser;
  ldapSyncInfo: SyncInfo;
  ldapError: LdapError;
  userError?: LdapError;

  loadLdapState: typeof loadLdapState;
  loadUserMapping: typeof loadUserMapping;
  clearUserError: typeof clearUserError;
}

interface State {
  isLoading: boolean;
}

export class LdapPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    await this.fetchLDAPStatus();
    this.setState({ isLoading: false });
  }

  async fetchLDAPStatus() {
    const { loadLdapState } = this.props;
    return await loadLdapState();
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
    const { ldapUser, userError, ldapSyncInfo, ldapConnectionInfo, navModel } = this.props;
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
            <LdapConnectionStatus
              headingStyle={headingStyle}
              tableStyle={tableStyle}
              ldapConnectionInfo={ldapConnectionInfo}
            />

            {config.buildInfo.isEnterprise && (
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
            {ldapUser && [
              <LdapUserPermissions className={tableStyle} key="permissions" permissions={ldapUser.permissions} />,
              <LdapUserMappingInfo className={tableStyle} key="mappingInfo" info={ldapUser.info} />,
              ldapUser.roles && ldapUser.roles.length > 0 && (
                <LdapUserGroups className={tableStyle} key="groups" groups={ldapUser.roles} />
              ),
              ldapUser.teams && ldapUser.teams.length > 0 && (
                <LdapUserTeams className={tableStyle} key="teams" teams={ldapUser.teams} />
              ),
            ]}
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
});

const mapDispatchToProps = {
  loadLdapState,
  loadUserMapping,
  clearUserError,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapPage)
);
