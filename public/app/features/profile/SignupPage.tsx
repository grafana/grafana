import React from 'react';
import SignupCtrl from './SignupCtrl';
import { SignupForm } from './SignupForm';
import Page from 'app/core/components/Page/Page';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';

interface Props {
  navModel: NavModel;
}
export class SignupPage extends React.PureComponent<Props> {
  render() {
    return (
      <Page navModel={this.props.navModel}>
        <Page.Contents>
          <SignupCtrl>{props => <SignupForm {...props} />}</SignupCtrl>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'signup'),
});

export default hot(module)(connect(mapStateToProps)(SignupPage));
