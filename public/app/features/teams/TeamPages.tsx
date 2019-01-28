import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';
import TeamGroupSync from './TeamGroupSync';
import { NavModel, Team } from 'app/types';
import { loadTeam } from './state/actions';
import { getTeam } from './state/selectors';
import { getTeamLoadingNav } from './state/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId, getRouteParamsPage } from '../../core/selectors/location';

export interface Props {
  team: Team;
  loadTeam: typeof loadTeam;
  teamId: number;
  pageName: string;
  navModel: NavModel;
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
    this.setState({isLoading: true});
    const team = await loadTeam(teamId);
    this.setState({isLoading: false});
    return team;
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.pageName;
    return _.includes(pages, currentPage) ? currentPage : pages[0];
  }

  renderPage() {
    const { isSyncEnabled } = this.state;
    const currentPage = this.getCurrentPage();

    switch (currentPage) {
      case PageTypes.Members:
        return <TeamMembers syncEnabled={isSyncEnabled} />;

      case PageTypes.Settings:
        return <TeamSettings />;
      case PageTypes.GroupSync:
        return isSyncEnabled && <TeamGroupSync />;
    }

    return null;
  }

  render() {
    const { team, navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={this.state.isLoading}>
          {team && Object.keys(team).length !== 0 && <div className="page-container page-body">{this.renderPage()}</div>}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state) {
  const teamId = getRouteParamsId(state.location);
  const pageName = getRouteParamsPage(state.location) || 'members';
  const teamLoadingNav = getTeamLoadingNav(pageName);

  return {
    navModel: getNavModel(state.navIndex, `team-${pageName}-${teamId}`, teamLoadingNav),
    teamId: teamId,
    pageName: pageName,
    team: getTeam(state.team, teamId),
  };
}

const mapDispatchToProps = {
  loadTeam,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TeamPages));
