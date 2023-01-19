import React from 'react';

import { LoginLayout, InnerBox } from '../Login/LoginLayout';

import { VerifyEmail } from './VerifyEmail';

export const VerifyEmailPage = () => {
  return (
    <LoginLayout>
      <InnerBox>
        <VerifyEmail />
      </InnerBox>
    </LoginLayout>
  );
};

export default VerifyEmailPage;
