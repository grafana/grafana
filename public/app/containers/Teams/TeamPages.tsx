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
  constructor(props) {
    super(props);

    this.loadTeam();
  }

  async loadTeam() {
    const { teams, nav, view } = this.props;

    await teams.loadById(view.routeParams.get('id'));

    nav.initTeamPage(this.getCurrentTeam(), this.getCurrentPage());
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.view.routeParams.get('page');
    return _.includes(pages, currentPage) ? currentPage : pages[0];
  }

  getCurrentTeam(): ITeam {
    return this.props.teams.map.get(this.props.view.routeParams.get('id'));
  }

  render() {
    const { nav } = this.props;

    const currentTeam = this.getCurrentTeam();
    const currentPage = this.getCurrentPage();
    const isSyncEnabled = config.buildInfo.isEnterprise;

    if (!currentTeam || !nav.main) {
      return null;
    }

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          {currentPage === 'members' && <TeamMembers team={currentTeam} />}
          {currentPage === 'settings' && <TeamSettings team={currentTeam} />}
          {currentPage === 'groupsync' && isSyncEnabled && <TeamGroupSync team={currentTeam} />}
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamPages);
