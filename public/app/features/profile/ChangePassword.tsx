import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import config from 'app/core/config';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/data';
import { Button, LinkButton } from '@grafana/ui';
import { UserProvider } from 'app/core/utils/UserProvider';
import Page from 'app/core/components/Page/Page';
import { PasswordInput } from 'app/core/components/PasswordInput/PasswordInput';

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

  render() {
    const { navModel } = this.props;
    const { oldPassword, newPassword, confirmNew } = this.state;
    const { ldapEnabled, authProxyEnabled } = config;
    const isLoading = false;
    return (
      <Page navModel={navModel}>
        <UserProvider>
          {({ changePassword }) => (
            <Page.Contents isLoading={isLoading}>
              <h3 className="page-sub-heading">Change Your Password</h3>
              {ldapEnabled && authProxyEnabled ? (
                <p>You cannot change password when ldap or auth proxy authentication is enabled.</p>
              ) : (
                <form name="userForm" className="gf-form-group">
                  <div className="gf-form max-width-30">
                    <PasswordInput
                      label="Old Password"
                      onChange={this.onOldPasswordChange.bind(this)}
                      value={oldPassword}
                    />
                  </div>
                  <div className="gf-form max-width-30">
                    <PasswordInput
                      label="New Password"
                      onChange={this.onNewPasswordChange.bind(this)}
                      value={newPassword}
                    />
                  </div>
                  <div className="gf-form max-width-30">
                    <PasswordInput
                      label="Confirm Password"
                      onChange={this.onConfirmPasswordChange.bind(this)}
                      value={confirmNew}
                    />
                  </div>
                  <div className="gf-form-button-row">
                    <Button
                      variant="primary"
                      onClick={event => {
                        event.preventDefault();
                        changePassword({ oldPassword, newPassword, confirmNew });
                      }}
                    >
                      Change Password
                    </Button>
                    <LinkButton variant="transparent" href={`${config.appSubUrl}/profile`}>
                      Cancel
                    </LinkButton>
                  </div>
                </form>
              )}
            </Page.Contents>
          )}
        </UserProvider>
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
