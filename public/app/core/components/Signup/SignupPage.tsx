import React, { FC } from 'react';
import { LoginLayout, InnerBox } from '../Login/LoginLayout';
import { Signup } from './Signup';

export const SignupPage: FC = () => {
  return (
    <LoginLayout>
      <InnerBox>
        <Signup />
      </InnerBox>
    </LoginLayout>
  );
};

export default SignupPage;
