import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import Page from 'app/core/components/Page/Page';
import UserProfile from './UserProfile';
import UserSessions from './UserSessions';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { getRouteParamsId } from 'app/core/selectors/location';

export interface Props {
  adminMode?: boolean;
  uid?: number;
}

export class UserAccount extends PureComponent<Props> {
  render() {
    const { adminMode, uid } = this.props;
    const isLoading = false;
    return (
      <Page.Contents isLoading={isLoading}>
        <UserProfile adminMode={adminMode} uid={uid} />
        {!adminMode && <SharedPreferences resourceUri="user" />}
        <UserSessions adminMode={adminMode} uid={uid} />
      </Page.Contents>
    );
  }
}

function mapStateToProps(state: StoreState) {
  const userId = getRouteParamsId(state.location);
  return {
    uid: userId ? userId : null,
  };
}

const mapDispatchToProps = {};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAccount)
);
