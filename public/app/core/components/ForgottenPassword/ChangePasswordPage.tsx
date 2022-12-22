import React, { FC } from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import LoginCtrl from '../Login/LoginCtrl';
import { LoginLayout, InnerBox } from '../Login/LoginLayout';

import { ChangePassword } from './ChangePassword';

export interface Props extends GrafanaRouteComponentProps<{}, { code: string }> {}

export const ChangePasswordPage: FC<Props> = (props) => {
  return (
    <LoginLayout>
      <InnerBox>
        <LoginCtrl resetCode={props.queryParams.code}>
          {({ changePassword }) => <ChangePassword onSubmit={changePassword} />}
        </LoginCtrl>
      </InnerBox>
    </LoginLayout>
  );
};

export default ChangePasswordPage;
