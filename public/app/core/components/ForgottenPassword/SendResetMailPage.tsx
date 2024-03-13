import React from 'react';

import { Branding } from '../Branding/Branding';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';

import { ForgottenPassword } from './ForgottenPassword';

export const SendResetMailPage = () => (
  <LoginLayout branding={{version: Branding.Version}}>
    <InnerBox>
      <ForgottenPassword />
    </InnerBox>
  </LoginLayout>
);

export default SendResetMailPage;
