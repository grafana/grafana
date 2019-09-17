import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import Page from 'app/core/components/Page/Page';
import { UserProfile } from './UserProfile';
import { StoreState, UserDTO, UserOrg } from 'app/types';
import { loadUserProfile, loadUserOrgs } from './state/actions';

interface Props {
  navModel: NavModel;
  userId: number;
  user: UserDTO;
  orgs: UserOrg[];

  loadUserProfile: typeof loadUserProfile;
  loadUserOrgs: typeof loadUserOrgs;
}

interface State {
  isLoading: boolean;
}

export class UserAdminPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    const { userId, loadUserProfile, loadUserOrgs } = this.props;
    try {
      await loadUserProfile(userId);
      await loadUserOrgs(userId);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  render() {
    const { navModel, user, orgs } = this.props;
    const { isLoading } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <UserProfile user={user} orgs={orgs} />
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  userId: getRouteParamsId(state.location),
  navModel: getNavModel(state.navIndex, 'global-users'),
  user: state.userAdmin.user,
  sessions: state.userAdmin.sessions,
  orgs: state.userAdmin.orgs,
});

const mapDispatchToProps = {
  loadUserProfile,
  loadUserOrgs,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAdminPage)
);
