import React, { PureComponent, ChangeEvent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { Input, FormLabel, Button, LinkButton } from '@grafana/ui';

export interface Props {
  navModel: NavModel;
}

export interface State {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}

export class ChangePassword extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      oldPassword: '',
      newPassword: '',
      confirmNew: '',
    };
  }

  onOldPasswordChange(oldPassword: string) {
    this.setState({ oldPassword });
  }

  onNewPasswordChange(newPassword: string) {
    this.setState({ newPassword });
  }

  onConfirmPasswordChange(confirmNew: string) {
    this.setState({ confirmNew });
  }

  onChangePassword = async () => {
    await getBackendSrv().put('/api/user/password', this.state);
  };

  cancel() {
    window.location.href = 'profile';
  }

  render() {
    const { navModel } = this.props;
    const { oldPassword, newPassword, confirmNew } = this.state;
    const { ldapEnabled, authProxyEnabled } = config;
    const isLoading = false;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <h3 className="page-sub-heading">Change Your Password</h3>
          {ldapEnabled && authProxyEnabled ? (
            <p>You cannot change password when ldap or auth proxy authentication is enabled.</p>
          ) : (
            <form name="userForm" className="gf-form-group">
              <div className="gf-form max-width-30">
                <FormLabel className="width-8">Old Password</FormLabel>
                <Input
                  className="gf-form-input max-width-22"
                  type="password"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onOldPasswordChange(event.target.value)}
                  value={oldPassword}
                />
              </div>
              <div className="gf-form max-width-30">
                <FormLabel className="width-8">New Password</FormLabel>
                <Input
                  className="gf-form-input max-width-22"
                  type="password"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onNewPasswordChange(event.target.value)}
                  value={newPassword}
                />
              </div>
              <div className="gf-form max-width-30">
                <FormLabel className="width-8">Confirm Password</FormLabel>
                <Input
                  className="gf-form-input max-width-22"
                  type="password"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onConfirmPasswordChange(event.target.value)}
                  value={confirmNew}
                />
              </div>
              <div className="gf-form-button-row">
                <Button variant="primary" onClick={this.onChangePassword}>
                  Change Password
                </Button>
                <LinkButton variant="transparent" href={`${config.appSubUrl}/profile`}>
                  Cancel
                </LinkButton>
              </div>
            </form>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `change-password`),
  };
}

const mapDispatchToProps = {};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(ChangePassword)
);
