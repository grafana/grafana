import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import Page from '../../core/components/Page/Page';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
// import config from '../../core/config';
import { getNavModel } from '../../core/selectors/navModel';
import { AppNotificationSeverity, LdapError, LdapUser, StoreState } from 'app/types';
import { loadUserMapping, clearUserError } from './state/actions';
import { LdapUserInfo } from './LdapUserInfo';
import { getRouteParamsLogin } from 'app/core/selectors/location';

interface Props {
  navModel: NavModel;
  login: string;
  ldapUser: LdapUser;
  userError?: LdapError;

  loadUserMapping: typeof loadUserMapping;
  clearUserError: typeof clearUserError;
}

interface State {
  isLoading: boolean;
}

export class LdapUserPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    const { login } = this.props;
    await this.fetchUserInfo(login);
    this.setState({ isLoading: false });
  }

  async fetchUserInfo(username: string) {
    const { loadUserMapping } = this.props;
    return await loadUserMapping(username);
  }

  onClearUserError = () => {
    this.props.clearUserError();
  };

  render() {
    const { ldapUser, userError, navModel } = this.props;
    const { isLoading } = this.state;

    const tableStyle = css`
      margin-bottom: 48px;
    `;

    const headingStyle = css`
      margin-bottom: 24px;
    `;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="grafana-info-box">
            This user is synced via LDAP – all changes must be done in LDAP config file.
          </div>
          {userError && userError.title && (
            <AlertBox
              title={userError.title}
              severity={AppNotificationSeverity.Error}
              body={userError.body}
              onClose={this.onClearUserError}
            />
          )}
          {ldapUser && <LdapUserInfo className={tableStyle} ldapUser={ldapUser} />}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  login: getRouteParamsLogin(state.location),
  navModel: getNavModel(state.navIndex, 'global-users'),
  ldapUser: state.ldap.user,
  userError: state.ldap.userError,
});

const mapDispatchToProps = {
  loadUserMapping,
  clearUserError,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapUserPage)
);
