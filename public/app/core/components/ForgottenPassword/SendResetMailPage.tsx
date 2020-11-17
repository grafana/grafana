import React, { FC } from 'react';

import { LoginLayout, InnerBox } from '../Login/LoginLayout';
import { ForgottenPassword } from './ForgottenPassword';

export const SendResetMailPage: FC = () => (
  <LoginLayout>
    <InnerBox>
      <ForgottenPassword />
    </InnerBox>
  </LoginLayout>
);

export default SendResetMailPage;
