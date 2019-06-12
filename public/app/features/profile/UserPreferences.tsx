import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import UserAccount from 'app/core/components/UserAccount/UserAccount';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/ui';

export interface Props {
  navModel: NavModel;
}

export class UserPreferences extends PureComponent<Props> {
  render() {
    const { navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <UserAccount admin="false" />
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `profile-settings`),
  };
}

const mapDispatchToProps = {};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserPreferences)
);
