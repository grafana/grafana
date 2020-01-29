import React from 'react';
import SignupCtrl from './SignupCtrl';
import { SignupForm } from './SignupForm';
import Page from 'app/core/components/Page/Page';

const navModel = {
  main: {
    icon: 'gicon gicon-branding',
    text: 'Sign Up',
    subTitle: 'Register your Grafana account',
    breadcrumbs: [{ title: 'Login', url: 'login' }],
  },
  node: {
    icon: 'gicon gicon-branding',
    text: 'Sign Up',
    subTitle: 'Register your Grafana account',
    breadcrumbs: [{ title: 'Login', url: 'login' }],
  },
};
export class SignupPage extends React.PureComponent {
  render() {
    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <div className="signup">
            <h3 className="p-b-1">You're almost there.</h3>
            <div className="p-b-1">
              We just need a couple of more bits of
              <br /> information to finish creating your account.
            </div>

            <SignupCtrl>{props => <SignupForm {...props} />}</SignupCtrl>
          </div>
        </Page.Contents>
      </Page>
    );
  }
}
