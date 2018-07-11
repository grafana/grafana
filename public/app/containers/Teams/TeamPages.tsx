import React from 'react';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import config from 'app/core/config';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavStore } from 'app/stores/NavStore/NavStore';
import { TeamsStore, ITeam } from 'app/stores/TeamsStore/TeamsStore';
import { ViewStore } from 'app/stores/ViewStore/ViewStore';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';
import TeamGroupSync from './TeamGroupSync';

interface Props {
  nav: typeof NavStore.Type;
  teams: typeof TeamsStore.Type;
  view: typeof ViewStore.Type;
}

@inject('nav', 'teams', 'view')
@observer
export class TeamPages extends React.Component<Props, any> {
  isSyncEnabled: boolean;
  currentTeam: ITeam;
  currentPage: string;

  constructor(props) {
    super(props);

    this.isSyncEnabled = config.buildInfo.isEnterprise;
    this.currentPage = this.getCurrentPage();

    this.loadTeam();
  }

  async loadTeam() {
    const { teams, nav, view } = this.props;

    await teams.loadById(view.routeParams.get('id'));

    this.currentTeam = teams.map.get(view.routeParams.get('id'));
    nav.initTeamPage(this.currentTeam, this.currentPage, this.isSyncEnabled);
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.view.routeParams.get('page');
    return _.includes(pages, currentPage) ? currentPage : pages[0];
  }

  render() {
    const { nav } = this.props;

    if (!nav.main || !this.currentTeam) {
      return null;
    }

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          {this.currentPage === 'members' && <TeamMembers team={this.currentTeam} />}
          {this.currentPage === 'settings' && <TeamSettings team={this.currentTeam} />}
          {this.currentPage === 'groupsync' && this.isSyncEnabled && <TeamGroupSync team={this.currentTeam} />}
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamPages);
