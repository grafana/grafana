import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import Page from 'app/core/components/Page/Page';
import UserProfile from './UserProfile';
import UserSessions from './UserSessions';
import NewUserPassword from './Admin/NewUserPassword';
import UserTeams from './UserTeams';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { loadUser } from './state/actions';
import { OrgUser } from 'app/types';
import { getRouteParamsId } from 'app/core/selectors/location';

export interface Props {
  adminMode?: boolean;
  uid?: number;
  user: OrgUser;
  loadUser: typeof loadUser;
}

export class UserEdit extends PureComponent<Props> {
  async componentDidMount() {
    const { uid } = this.props;
    await this.props.loadUser(uid);
  }

  render() {
    const { adminMode, uid, user } = this.props;
    const isLoading = Object.keys(user).length === 0;
    return (
      <Page.Contents isLoading={isLoading}>
        {!isLoading && <UserProfile adminMode={adminMode} uid={uid} />}
        {adminMode && <NewUserPassword uid={uid} />}
        {!adminMode && <SharedPreferences resourceUri="user" />}
        {!adminMode && <UserTeams />}
        <UserSessions adminMode={adminMode} uid={uid} />
      </Page.Contents>
    );
  }
}

function mapStateToProps(state: StoreState) {
  const userId = getRouteParamsId(state.location);
  return {
    uid: userId ? userId : null,
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
  )(UserEdit)
);
