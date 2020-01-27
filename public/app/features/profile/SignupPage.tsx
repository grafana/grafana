import React, { FC } from 'react';
import SignupCtrl from './SignupCtrl';
import { SignupForm } from './SignupForm';

export const SignupPage: FC = () => {
  return <SignupCtrl>{props => <SignupForm {...props} />}</SignupCtrl>;
};
