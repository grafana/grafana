import React from 'react';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { hot } from 'react-hot-loader';

export interface FormModel {
  user: string;
  password: string;
  email: string;
}
interface Props {
  routeParams?: any;
  updateLocation?: typeof updateLocation;
  children: (obj: {
    isLoggingIn: boolean;
    changePassword: (pw: { newPassword: string; confirmNew: string; oldPassword: string }, valid: boolean) => void;
    isChangingPassword: boolean;
    toGrafana: Function;
    login: (data: FormModel, valid: boolean) => void;
  }) => JSX.Element;
}

interface State {
  isLoggingIn: boolean;
  isChangingPassword: boolean;
}

export class LoginCtrl extends PureComponent<Props, State> {
  result: any = {};
  constructor(props: Props) {
    super(props);
    this.state = {
      isLoggingIn: false,
      isChangingPassword: false,
    };
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
  }

  changePassword = (pws: { newPassword: string; confirmNew: string }, valid: boolean) => {
    console.log('Changing PW');
    if (!valid) {
      return;
    }

    getBackendSrv()
      .put('/api/user/password', pws)
      .then(() => {
        this.toGrafana();
      })
      .catch((err: any) => console.log(err));
  };

  login = (formModel: FormModel, valid: boolean) => {
    console.log(formModel);
    console.log(this);
    if (!valid) {
      return;
    }
    this.setState({
      isLoggingIn: true,
    });

    getBackendSrv()
      .post('/login', formModel)
      .then((result: any) => {
        this.result = result;
        console.log(result);
        if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
          this.toGrafana();
          return;
        } else {
          this.changeView();
        }
      })
      .catch(() => {
        this.setState({
          isLoggingIn: false,
        });
      });
  };

  changeView = () => {
    this.setState({
      isChangingPassword: true,
    });
  };

  toGrafana = () => {
    console.log('Trying to get to Grafana');
    const params = this.props.routeParams;
    // Use window.location.href to force page reload
    if (params.redirect && params.redirect[0] === '/') {
      window.location.href = config.appSubUrl + params.redirect;

      // this.props.updateLocation({
      //   path: config.appSubUrl + params.redirect,
      // });
    } else if (this.result.redirectUrl) {
      window.location.href = config.appSubUrl + params.redirect;

      // this.props.updateLocation({
      //   path: this.result.redirectUrl,
      // });
    } else {
      window.location.href = config.appSubUrl + '/';

      // this.props.updateLocation({
      //   path: '/',
      // });
    }
  };

  render() {
    const { children } = this.props;
    const { isLoggingIn, isChangingPassword } = this.state;
    const { login, toGrafana, changePassword } = this;

    return <>{children({ login, isLoggingIn, changePassword, toGrafana, isChangingPassword })}</>;
  }
}

export const mapStateToProps = (state: StoreState) => ({
  routeParams: state.location.routeParams,
});

const mapDispatchToProps = { updateLocation };

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LoginCtrl)
);
