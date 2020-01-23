import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { hot } from 'react-hot-loader';

interface SignupProps {
  children(arg0: ChildProps): JSX.Element;
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
}

export class SignupCtrl extends PureComponent<SignupProps, SignupCtrlState> {
  constructor(props: SignupProps) {
    super(props);
    //Set initial values from url via props.routeParams
  }
  onSubmit = async ({ email, code, orgName, password, name }: any) => {
    const backendSrv = getBackendSrv();
    console.log(email);
    const response = await backendSrv.post('/api/user/signup/step2', {
      email,
      code,
      username: email,
      orgName,
      password,
    });
    if (response.code === 'redirect-to-select-org') {
      //select location
      console.log('Redirecting...');
    }

    // redirect to /
  };

  render() {
    const { children } = this.props;
    return (
      <>
        {children({
          onSubmit: this.onSubmit,
          autoAssignOrg: false,
          verifyEmailEnabled: true,
        })}
      </>
    );
  }
}

export const mapStateToProps = (state: StoreState) => ({
  routeParams: state.location.routeParams,
});

const mapDispatchToProps = { updateLocation };

export default hot(module)(connect(mapStateToProps, mapDispatchToProps));
