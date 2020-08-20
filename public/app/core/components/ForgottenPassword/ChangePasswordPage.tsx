import React, { FC } from 'react';
import { LoginLayout, InnerBox } from '../Login/LoginLayout';
import { ChangePassword } from './ChangePassword';
import LoginCtrl from '../Login/LoginCtrl';

export const ChangePasswordPage: FC = () => {
  return (
    <LoginLayout>
      <InnerBox>
        <LoginCtrl>{({ changePassword }) => <ChangePassword onSubmit={changePassword} />}</LoginCtrl>
      </InnerBox>
    </LoginLayout>
  );
};

export default ChangePasswordPage;
