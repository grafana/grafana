import React, { FC } from 'react';
import { SignupCtrl } from './SignupCtrl';
import { SignupForm } from './SignupForm';

interface Props {
  verifyEmailEnabled: boolean;
  autoAssignOrg: boolean;
  model: {
    email: string;
    password: string;
    code: string;
    orgName: string;
    username: string;
    name: string;
    verifyEmailEnabled: boolean;
  };
}

export const Signup: FC<Props> = props => {
  console.log(props);
  return <SignupCtrl>{({ register }) => <SignupForm onSubmit={register} />}</SignupCtrl>;
};
