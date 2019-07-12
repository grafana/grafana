import React, { FC } from 'react';
import config from 'app/core/config';

export const UserSignup: FC<any> = ({}) => {
  return config.disableUserSignUp ? null : (
    <div className="login-signup-box">
      <div className="login-signup-title p-r-1">New to Grafana?</div>
      <a href="signup" className="btn btn-medium btn-signup btn-p-x-2">
        Sign Up
      </a>
    </div>
  );
};
