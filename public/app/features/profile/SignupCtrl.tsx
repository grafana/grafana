import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';

interface SignupProps {
  children(arg0: ChildProps): JSX.Element;
}

interface ChildProps {
  onSubmit(e: React.FocusEvent): void;
}

export class SignupCtrl extends PureComponent<SignupProps> {
  constructor(props: SignupProps) {
    super(props);
  }
  onSubmit = async () => {
    const backendSrv = getBackendSrv();

    const response = await backendSrv.post('/api/user/signup/step2');
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
        })}
      </>
    );
  }
}
