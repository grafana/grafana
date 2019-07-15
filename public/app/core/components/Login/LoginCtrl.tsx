import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';
import { backendSrv } from 'test/mocks/common';

interface Props {
  routeParams: any;
  updateLocation: typeof updateLocation;
}
interface State {
  formModel: {
    user: string;
    email: string;
    password: string;
  };
  validForm: boolean;
}

export class LoginCtrl extends PureComponent<Props, State> {
  result: any = {};

  init() {
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
  }
  signUp() {
    if (!this.state.validForm) {
      return;
    }

    backendSrv.post('/api/user/signup', this.state.formModel).then((result: any) => {
      if (result.status === 'SignUpCreated') {
        // $location.path('/signup').search({ email: $scope.formModel.email });
        this.props.updateLocation({
          path: '/signup',
        });
      } else {
        // window.location.href = config.appSubUrl + '/';
      }
    });
  }

  login() {}

  skip() {}

  changeView() {}

  submit(loginMode = true) {
    if (loginMode) {
      this.login();
    } else {
      this.signUp();
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
