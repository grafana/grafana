import React from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { Branding } from '../Branding/Branding';
import LoginCtrl from '../Login/LoginCtrl';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';

import { ChangePassword } from './ChangePassword';

export interface Props extends GrafanaRouteComponentProps<{}, { code: string }> {}

export const ChangePasswordPage = (props: Props) => {
  return (
    <LoginLayout isChangingPassword branding={{version: Branding.Version}}>
      <InnerBox>
        <LoginCtrl resetCode={props.queryParams.code}>
          {({ changePassword }) => <ChangePassword onSubmit={changePassword} />}
        </LoginCtrl>
      </InnerBox>
    </LoginLayout>
  );
};

export default ChangePasswordPage;
