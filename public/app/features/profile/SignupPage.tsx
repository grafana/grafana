import React, { FC } from 'react';
import { SignupForm } from './SignupForm';
import Page from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { StoreState } from 'app/types';

const navModel = {
  main: {
    icon: 'grafana',
    text: 'Sign Up',
    subTitle: 'Register your Grafana account',
    breadcrumbs: [{ title: 'Login', url: 'login' }],
  },
  node: {
    text: '',
  },
};

interface Props {
  email?: string;
  orgName?: string;
  username?: string;
  code?: string;
  name?: string;
}
export const SignupPage: FC<Props> = props => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="p-b-1">You're almost there.</h3>
        <div className="p-b-1">
          We just need a couple of more bits of
          <br /> information to finish creating your account.
        </div>
        <SignupForm
          {...props}
          verifyEmailEnabled={getConfig().verifyEmailEnabled}
          autoAssignOrg={getConfig().autoAssignOrg}
        />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  ...state.location.routeParams,
});

export default hot(module)(connect(mapStateToProps)(SignupPage));
