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

    nav.initTeamPage(this.getCurrentTeam(), this.currentPage, this.isSyncEnabled);
  }

  getCurrentTeam(): ITeam {
    const { teams, view } = this.props;
    return teams.map.get(view.routeParams.get('id'));
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.view.routeParams.get('page');
    return _.includes(pages, currentPage) ? currentPage : pages[0];
  }

  render() {
    const { nav } = this.props;
    const currentTeam = this.getCurrentTeam();

    if (!nav.main) {
      return null;
    }

    return (
      <div>
        <PageHeader model={nav as any} />
        {currentTeam && (
          <div className="page-container page-body">
            {this.currentPage === 'members' && <TeamMembers team={currentTeam} />}
            {this.currentPage === 'settings' && <TeamSettings team={currentTeam} />}
            {this.currentPage === 'groupsync' && this.isSyncEnabled && <TeamGroupSync team={currentTeam} />}
          </div>
        )}
      </div>
    );
  }
}

export default hot(module)(TeamPages);
