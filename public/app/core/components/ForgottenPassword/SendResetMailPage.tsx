import React from 'react';

import { LoginLayout, InnerBox } from '../Login/LoginLayout';

import { ForgottenPassword } from './ForgottenPassword';

export const SendResetMailPage = () => (
  <LoginLayout>
    <InnerBox>
      <ForgottenPassword />
    </InnerBox>
  </LoginLayout>
);

export default SendResetMailPage;
