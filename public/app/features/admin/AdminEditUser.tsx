import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import Page from 'app/core/components/Page/Page';
import UserEdit from 'app/core/components/UserEdit/UserEdit';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/ui';

export interface Props {
  navModel: NavModel;
}

export class AdminEditUser extends PureComponent<Props> {
  render() {
    const { navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <UserEdit adminMode />
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
  )(AdminEditUser)
);
