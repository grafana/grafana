import React from 'react';

import { Branding } from '../Branding/Branding';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';

import { VerifyEmail } from './VerifyEmail';

export const VerifyEmailPage = () => {
  return (
    <LoginLayout branding={{version: Branding.Version}}>
      <InnerBox>
        <VerifyEmail />
      </InnerBox>
    </LoginLayout>
  );
};

export default VerifyEmailPage;
