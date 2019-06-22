import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState, OrgUser } from 'app/types';
import { loadUser } from 'app/core/components/UserEdit/state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import UserProfile from 'app/core/components/UserEdit/UserProfile';
import UserSessions from 'app/core/components/UserEdit/UserSessions';
import UserTeams from 'app/core/components/UserEdit/UserTeams';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';

export interface Props {
  navModel: NavModel;
  user: OrgUser;
  loadUser: typeof loadUser;
}

export class UserPreferences extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.loadUser();
  }

  render() {
    const { navModel, user } = this.props;
    const isLoading = Object.keys(user).length === 0;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          {!isLoading && <UserProfile />}
          <SharedPreferences resourceUri="user" />
          <UserTeams />
          <UserSessions />
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `profile-settings`),
    user: state.user.profile,
  };
}

const mapDispatchToProps = {
  loadUser,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserPreferences)
);
