import React from 'react';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { hot } from 'react-hot-loader';

let backendSrv;

export interface FormModel {
  user: string;
  password: string;
  email: string;
}
interface Props {
  routeParams?: any;
  updateLocation?: typeof updateLocation;
  children: (obj: {
    loggingIn: boolean;
    changePassword: (pw: { newPassword: string; confirmNew: string }, valid: boolean) => void;
    needPassword: boolean;
    toGrafana: Function;
    signUp: Function;
    login: (data: FormModel, valid: boolean) => void;
  }) => JSX.Element;
}

interface State {
  loggingIn: boolean;
  needPassword: boolean;
}

export class LoginCtrl extends PureComponent<Props, State> {
  result: any = {};
  constructor(props: Props) {
    super(props);
    this.state = {
      loggingIn: false,
      needPassword: false,
    };
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
    backendSrv = getBackendSrv();
  }

  signUp = (formModel: FormModel, valid: boolean) => {};

  changePassword = (pws: { newPassword: string; confirmNew: string }, valid: boolean) => {
    console.log('Changing PW');
    if (!valid) {
      return;
    }

    backendSrv
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
      loggingIn: true,
    });

    backendSrv
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
          loggingIn: false,
        });
      });
  };

  changeView = () => {
    // Implement animation
    this.setState({
      needPassword: true,
    });
  };

  toGrafana = () => {
    console.log('Trying to get to Grafana');
    const params = this.props.routeParams;
    console.log(this.props);
    if (params.redirect && params.redirect[0] === '/') {
      //   window.location.href = config.appSubUrl + params.redirect;

      console.log(`Going to ${params.redirect}`);
      this.props.updateLocation({
        path: config.appSubUrl + params.redirect,
      });
    } else if (this.result.redirectUrl) {
      console.log('Going to redirect');
      this.props.updateLocation({
        path: this.result.redirectUrl,
      });
    } else {
      console.log('Going to home');
      this.props.updateLocation({
        path: '/',
      });
    }
  };

  render() {
    const { children } = this.props;
    const { loggingIn, needPassword } = this.state;
    const { login, signUp, toGrafana, changePassword } = this;

    return <>{children({ login, signUp, loggingIn, changePassword, toGrafana, needPassword })}</>;
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
