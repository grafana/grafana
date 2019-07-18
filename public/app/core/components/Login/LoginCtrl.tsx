import React from 'react';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';

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
    submit: Function;
    signUp: Function;
    login: (data: FormModel) => void;
  }) => JSX.Element;
}

export class LoginCtrl extends PureComponent<Props, { loggingIn: boolean }> {
  result: any;
  constructor(props: Props) {
    super(props);
    this.state = {
      loggingIn: false,
    };
    this.setState = this.setState.bind(this);
  }

  init() {
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
  }
  signUp(formModel: FormModel) {}

  login(formModel: FormModel) {
    console.log(formModel);
    this.setState({
      loggingIn: true,
    });
  }

  skip() {}

  changeView() {}

  submit(loginMode = true, formModel: FormModel) {
    console.log('Submit called');
    if (loginMode) {
      this.login(formModel);
    } else {
      this.signUp(formModel);
    }
  }

  toGrafana() {
    const params = this.props.routeParams;

    if (params.redirect && params.redirect[0] === '/') {
      //   window.location.href = config.appSubUrl + params.redirect;
      this.props.updateLocation({
        // url: config.appSubUrl + params.redirect,
      });
    } else if (this.result.redirectUrl) {
      window.location.href = this.result.redirectUrl;
    } else {
      window.location.href = config.appSubUrl + '/';
    }
  }

  render() {
    const { children } = this.props;
    const { submit, login, signUp } = this;
    const { loggingIn } = this.state;

    return <>{children({ submit, login, signUp, loggingIn })}</>;
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
