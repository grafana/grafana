import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { FormField } from '@grafana/ui';
import Page from '../../core/components/Page/Page';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
import { LdapSyncInfo } from './LdapSyncInfo';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserTeams } from './LdapUserTeams';
import config from '../../core/config';
import { getNavModel } from '../../core/selectors/navModel';
import { AppNotificationSeverity, LdapError, LdapUser, StoreState, SyncInfo } from 'app/types';
import { loadLdapState, clearError } from './state/actions';

interface Props {
  navModel: NavModel;
  ldapUser: LdapUser;
  ldapSyncInfo: SyncInfo;
  ldapError: LdapError;

  loadLdapState: typeof loadLdapState;
  clearError: typeof clearError;
}

interface State {
  isLoading: boolean;
}

export class LdapPage extends PureComponent<Props, State> {
  state = {
    isLoading: false,
  };

  componentDidMount() {
    this.fetchLDAPStatus();
  }

  async fetchLDAPStatus() {
    const { loadLdapState } = this.props;
    const ldapStatus = await loadLdapState();
    console.log(ldapStatus);
  }

  search = (event: any) => {
    event.preventDefault();
    console.log('derp');
  };

  onClearError = () => {
    this.props.clearError();
  };

  render() {
    const { ldapError, ldapUser, ldapSyncInfo, navModel } = this.props;
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
            <div className="grafana-info-box">
              LDAP server connected
              <i className="fa fa-fw fa-check text-success pull-right" />
            </div>
            {config.buildInfo.isEnterprise && (
              <LdapSyncInfo headingStyle={headingStyle} tableStyle={tableStyle} ldapSyncInfo={ldapSyncInfo} />
            )}
            <h4 className={headingStyle}>User mapping</h4>
            <form onSubmit={this.search} className={`${searchStyle} gf-form-inline`}>
              <FormField label="User name" labelWidth={8} inputWidth={30} type="text" />
              <button type="submit" className="btn btn-primary">
                Test LDAP mapping
              </button>
            </form>
            {ldapError && ldapError.title && (
              <AlertBox
                title={ldapError.title}
                severity={AppNotificationSeverity.Error}
                body={ldapError.body}
                onClose={this.onClearError}
              />
            )}
            {ldapUser.permissions && [
              <LdapUserPermissions className={tableStyle} key="permissions" permissions={ldapUser.permissions} />,
              <LdapUserMappingInfo className={tableStyle} key="mappingInfo" info={ldapUser.info} />,
              ldapUser.roles.length > 0 && (
                <LdapUserGroups className={tableStyle} key="groups" groups={ldapUser.roles} />
              ),
              ldapUser.teams.length > 0 && <LdapUserTeams className={tableStyle} key="teams" teams={ldapUser.teams} />,
            ]}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'ldap'),
  ldapUser: state.ldap.user,
  ldapSyncInfo: state.ldap.syncInfo,
  ldapError: state.ldap.ldapError,
});

const mapDispatchToProps = {
  loadLdapState,
  clearError,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapPage)
);
