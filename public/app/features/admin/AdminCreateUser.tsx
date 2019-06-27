import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import UserProfile from 'app/core/components/UserEdit/UserProfile';

export interface Props {
  navModel: NavModel;
}

export class AdminCreateUser extends PureComponent<Props> {
  render() {
    const { navModel } = this.props;
    const isLoading = false;
    const adminMode = true;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <UserProfile adminMode={adminMode} userId={null} />
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `global-users`),
  };
}

const mapDispatchToProps = {};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(AdminCreateUser)
);
