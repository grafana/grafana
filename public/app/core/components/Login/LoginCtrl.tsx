import React from 'react';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';

let backendSrv;

console.log(backendSrv);
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
    signUp: Function;
    login: (data: FormModel, valid: boolean) => void;
  }) => JSX.Element;
}

export class LoginCtrl extends PureComponent<Props, { loggingIn: boolean }> {
  result: any;
  constructor(props: Props) {
    super(props);
    this.state = {
      loggingIn: false,
    };
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
    backendSrv = getBackendSrv();
  }

  init() {}
  signUp = (formModel: FormModel, valid: boolean) => {};

  login = (formModel: FormModel, valid: boolean) => {
    console.log(formModel);
    console.log(this);
    if (!valid) {
      return;
    }
    this.setState({
      loggingIn: true,
    });

    console.log(backendSrv);

    backendSrv
      .post('/login', formModel)
      .then((result: any) => {
        this.result = result;
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

  skip() {}

  changeView() {}

  toGrafana() {
    const params = this.props.routeParams;
    if (params.redirect && params.redirect[0] === '/') {
      console.log('HEY IM RUNNING!');
      //   window.location.href = config.appSubUrl + params.redirect;
      this.props.updateLocation({
        path: config.appSubUrl + params.redirect,
      });
    } else if (this.result.redirectUrl) {
      console.log('HEY IM RUNNING!');
      this.props.updateLocation({
        path: this.result.redirectUrl,
      });
    } else {
      console.log('HEY IM RUNNING!');
      this.props.updateLocation({
        path: '/',
      });
    }
  }

  render() {
    const { children } = this.props;
    const { loggingIn } = this.state;
    const { login, signUp } = this;

    return <>{children({ login, signUp, loggingIn })}</>;
  }
}

export const mapStateToProps = (state: StoreState) => ({
  routeParams: state.location.routeParams,
});

const mapDispatchToProps = { updateLocation };

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LoginCtrl);
