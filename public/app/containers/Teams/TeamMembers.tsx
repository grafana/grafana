import React from 'react';
import { hot } from 'react-hot-loader';
import { observer } from 'mobx-react';
import { ITeam } from 'app/stores/TeamsStore/TeamsStore';

interface Props {
  team: ITeam;
}

@observer
export class TeamMembers extends React.Component<Props, any> {
  constructor(props) {
    super(props);
  }

  onSearchQueryChange = evt => {
    //this.props.teams.setSearchQuery(evt.target.value);
  };

  renderMember() {
    return <tr />;
  }

  render() {
    const members = [];

    return (
      <div>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <label className="gf-form--has-input-icon gf-form--grow">
              <input
                type="text"
                className="gf-form-input"
                placeholder="Search members"
                value={''}
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
            <tbody>{members.map(member => this.renderMember())}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamMembers);
