import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState, OrgUser } from 'app/types';
import { loadUser, clearUser } from 'app/core/components/UserEdit/state/actions';
import { getRouteParamsId } from 'app/core/selectors/location';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import UserProfile from 'app/core/components/UserEdit/UserProfile';
import UserSessions from 'app/core/components/UserEdit/UserSessions';
import NewUserPassword from 'app/core/components/UserEdit/Admin/NewUserPassword';
import UserPermissions from 'app/core/components/UserEdit/Admin/UserPermissions';
import UserOrganizations from 'app/core/components/UserEdit/Admin/UserOrganizations';

export interface Props {
  navModel: NavModel;
  userId: number;
  user: OrgUser;
  loadUser: typeof loadUser;
  clearUser: typeof clearUser;
}

export class AdminEditUser extends PureComponent<Props> {
  async componentDidMount() {
    const { userId } = this.props;
    await this.props.loadUser(userId);
  }

  componentWillUnmount() {
    this.props.clearUser();
  }

  render() {
    const { navModel, userId, user } = this.props;
    const isLoading = Object.keys(user).length === 0;
    const adminMode = true;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          {!isLoading && <UserProfile adminMode={adminMode} userId={userId} />}
          {userId && (
            <>
              <NewUserPassword userId={userId} />
              {!isLoading && <UserPermissions userId={userId} />}
              <UserOrganizations userId={userId} />
              <UserSessions adminMode={adminMode} userId={userId} />
            </>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `global-users`),
    userId: getRouteParamsId(state.location),
    user: state.user.profile,
  };
}

const mapDispatchToProps = {
  loadUser,
  clearUser,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(AdminEditUser)
);
