import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { updateLocation } from 'app/core/actions';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { PureComponent } from 'react';
import { backendSrv } from 'test/mocks/common';

export interface FormModel {
  user: string;
  password: string;
  email: string;
}
interface Props {
  routeParams: any;
  updateLocation: typeof updateLocation;
}

export class LoginCtrl extends PureComponent<Props> {
  formModel: {
    user: string;
    email: string;
    password: string;
  };
  result: any = {};

  init() {
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
  }
  signUp(formModel: FormModel) {
    backendSrv.post('/api/user/signup', formModel).then((result: any) => {
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

  login(formModel: FormModel) {}

  skip() {}

  changeView() {}

  submit(loginMode = true, formModel: FormModel) {
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
