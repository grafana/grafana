import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { hot } from 'react-hot-loader';

interface SignupProps {
  children(arg0: ChildProps): JSX.Element;
  routeParams?: any;
  updateLocation: typeof updateLocation;
}

export interface SignupFormModel {
  email: string;
  username?: string;
  password: string;
  orgName: string;
  code?: string;
  name?: string;
}

interface ChildProps {
  onSubmit(obj: SignupFormModel): void;
  verifyEmailEnabled: boolean;
  autoAssignOrg: boolean;
}

interface SignupCtrlState {
  autoAssignOrg: boolean;
  verifyEmailEnabled: boolean;
  orgName: string;
  email: string;
  username: string;
  code?: string;
  password?: string;
}

export class SignupCtrl extends PureComponent<SignupProps, SignupCtrlState> {
  constructor(props: SignupProps) {
    super(props);
    //Set initial values from url via props.routeParams

    this.state = {
      verifyEmailEnabled: false,
      autoAssignOrg: true,
      orgName: props.routeParams.email,
      email: props.routeParams.email,
      username: props.routeParams.email,
      code: props.routeParams.code,
    };
  }

  componentDidMount() {
    getBackendSrv()
      .get('/api/user/signup/options')
      .then((options: any) => {
        this.setState({
          verifyEmailEnabled: options.verifyEmailEnabled,
          autoAssignOrg: options.autoAssignOrg,
        });
      })
      .catch(e => console.log(e));
  }

  onSubmit = async (formData: SignupFormModel) => {
    this.setState({
      autoAssignOrg: this.state.autoAssignOrg,
      verifyEmailEnabled: this.state.verifyEmailEnabled,
      username: formData.email,
      ...formData,
    });

    const response = await getBackendSrv().post('/api/user/signup/step2', {
      email: this.state.email,
      code: this.state.code,
      username: this.state.username,
      orgName: this.state.orgName,
      password: this.state.password,
    });
    if (response.code === 'redirect-to-select-org') {
      //select location
      this.props.updateLocation('/profile/select-org?signup=1');
      console.log('Redirecting...');
    }
    this.props.updateLocation('/');
  };

  render() {
    const { children } = this.props;
    const { autoAssignOrg, verifyEmailEnabled } = this.state;
    return (
      <>
        {children({
          onSubmit: this.onSubmit,
          autoAssignOrg,
          verifyEmailEnabled,
        })}
      </>
    );
  }
}

export const mapStateToProps = (state: StoreState) => ({
  routeParams: state.location.routeParams,
});

const mapDispatchToProps = { updateLocation };

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SignupCtrl));
