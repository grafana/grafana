import React from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavStore } from 'app/stores/NavStore/NavStore';
import { TeamsStore, ITeam } from 'app/stores/TeamsStore/TeamsStore';
import { ViewStore } from 'app/stores/ViewStore/ViewStore';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';

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
    const { view, teams, nav } = this.props;

    await teams.loadById(view.routeParams.get('id'));

    const currentTeam = this.getCurrentTeam();
    const currentPage = view.routeParams.get('page') || 'members';

    nav.initTeamPage(currentTeam, currentPage);
  }

  getCurrentTeam(): ITeam {
    return this.props.teams.map.get(this.props.view.routeParams.get('id'));
  }

  render() {
    const { nav, view } = this.props;
    const currentTeam = this.getCurrentTeam();
    const currentPage = view.routeParams.get('page') || 'members';

    if (!currentTeam || !nav.main) {
      return null;
    }

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          {currentPage === 'members' && <TeamMembers team={currentTeam} />}
          {currentPage === 'settings' && <TeamSettings team={currentTeam} />}
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamPages);
