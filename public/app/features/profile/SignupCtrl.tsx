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
  register(obj: SignupFormModel): void;
}

export class SignupCtrl extends PureComponent<SignupProps> {
  constructor(props: SignupProps) {
    super(props);
  }
  register = async ({ email, code, orgName, password, name }: any) => {
    const backendSrv = getBackendSrv();

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
          register: this.register,
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
