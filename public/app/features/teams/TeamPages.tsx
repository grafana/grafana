import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';
import TeamGroupSync from './TeamGroupSync';
import { Team, TeamMember } from 'app/types';
import { loadTeam, loadTeamMembers } from './state/actions';
import { getTeam, getTeamMembers, isSignedInUserTeamAdmin } from './state/selectors';
import { getTeamLoadingNav } from './state/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId, getRouteParamsPage } from '../../core/selectors/location';
import { contextSrv, User } from 'app/core/services/context_srv';
import { NavModel } from '@grafana/data';

export interface Props {
  team: Team;
  loadTeam: typeof loadTeam;
  loadTeamMembers: typeof loadTeamMembers;
  teamId: number;
  pageName: string;
  navModel: NavModel;
  members?: TeamMember[];
  editorsCanAdmin?: boolean;
  signedInUser?: User;
}

interface State {
  isSyncEnabled: boolean;
  isLoading: boolean;
}

enum PageTypes {
  Members = 'members',
  Settings = 'settings',
  GroupSync = 'groupsync',
}

export class TeamPages extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: false,
      isSyncEnabled: config.buildInfo.isEnterprise,
    };
  }

  async componentDidMount() {
    await this.fetchTeam();
  }

  async fetchTeam() {
    const { loadTeam, teamId } = this.props;
    this.setState({ isLoading: true });
    const team = await loadTeam(teamId);
    await this.props.loadTeamMembers();
    this.setState({ isLoading: false });
    return team;
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.pageName;
    return _.includes(pages, currentPage) ? currentPage : pages[0];
  }

  textsAreEqual = (text1: string, text2: string) => {
    if (!text1 && !text2) {
      return true;
    }

    if (!text1 || !text2) {
      return false;
    }

    return text1.toLocaleLowerCase() === text2.toLocaleLowerCase();
  };

  hideTabsFromNonTeamAdmin = (navModel: NavModel, isSignedInUserTeamAdmin: boolean) => {
    if (!isSignedInUserTeamAdmin && navModel.main && navModel.main.children) {
      navModel.main.children
        .filter(navItem => !this.textsAreEqual(navItem.text, PageTypes.Members))
        .map(navItem => {
          navItem.hideFromTabs = true;
        });
    }

    return navModel;
  };

  renderPage(isSignedInUserTeamAdmin: boolean) {
    const { isSyncEnabled } = this.state;
    const { members } = this.props;
    const currentPage = this.getCurrentPage();

    switch (currentPage) {
      case PageTypes.Members:
        return <TeamMembers syncEnabled={isSyncEnabled} members={members} />;

      case PageTypes.Settings:
        return isSignedInUserTeamAdmin && <TeamSettings />;
      case PageTypes.GroupSync:
        return isSignedInUserTeamAdmin && isSyncEnabled && <TeamGroupSync />;
    }

    return null;
  }

  render() {
    const { team, navModel, members, editorsCanAdmin, signedInUser } = this.props;
    const isTeamAdmin = isSignedInUserTeamAdmin({ members, editorsCanAdmin, signedInUser });

    return (
      <Page navModel={this.hideTabsFromNonTeamAdmin(navModel, isTeamAdmin)}>
        <Page.Contents isLoading={this.state.isLoading}>
          {team && Object.keys(team).length !== 0 && this.renderPage(isTeamAdmin)}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: any) {
  const teamId = getRouteParamsId(state.location);
  const pageName = getRouteParamsPage(state.location) || 'members';
  const teamLoadingNav = getTeamLoadingNav(pageName as string);
  const navModel = getNavModel(state.navIndex, `team-${pageName}-${teamId}`, teamLoadingNav);
  const team = getTeam(state.team, teamId);
  const members = getTeamMembers(state.team);

  return {
    navModel,
    teamId: teamId,
    pageName: pageName,
    team,
    members,
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadTeam,
  loadTeamMembers,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(TeamPages)
);
