import React from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavStore } from 'app/stores/NavStore/NavStore';
import { TeamsStore, ITeam } from 'app/stores/TeamsStore/TeamsStore';
import { ViewStore } from 'app/stores/ViewStore/ViewStore';

interface Props {
  nav: typeof NavStore.Type;
  teams: typeof TeamsStore.Type;
  view: typeof ViewStore.Type;
}

@inject('nav', 'teams', 'view')
@observer
export class TeamSettings extends React.Component<Props, any> {
  constructor(props) {
    super(props);

    this.props.nav.load('cfg', 'teams');
    this.loadTeam();
  }

  async loadTeam() {
    const { view, teams, nav } = this.props;

    await teams.loadById(view.routeParams.get('id'));

    const currentTeam = this.getCurrentTeam();
    nav.initTeamPage(currentTeam, 'team-members');
  }

  getCurrentTeam(): ITeam {
    return this.props.teams.map.get(this.props.view.routeParams.get('id'));
  }

  onSearchQueryChange = evt => {
    //this.props.teams.setSearchQuery(evt.target.value);
  };

  renderMember() {
    return <tr />;
  }

  render() {
    const { nav, teams } = this.props;
    const currentTeam = this.getCurrentTeam();
    const members = [];

    if (!currentTeam) {
      return null;
    }

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <label className="gf-form--has-input-icon gf-form--grow">
                <input
                  type="text"
                  className="gf-form-input"
                  placeholder="Search members"
                  value={teams.search}
                  onChange={this.onSearchQueryChange}
                />
                <i className="gf-form-input-icon fa fa-search" />
              </label>
            </div>

            <div className="page-action-bar__spacer" />

            <a className="btn btn-success" href="org/teams/new">
              <i className="fa fa-plus" /> Add a member
            </a>
          </div>

          <div className="admin-list-table">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Members</th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{members.map(member => this.renderMember(member))}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamSettings);
