import React, { PureComponent } from 'react';
import { Team } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';

export interface Props {}

export interface State {
  teams: Team[];
}

export class UserTeams extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      teams: [] as Team[],
    };
  }

  async componentDidMount() {
    await this.loadUserTeams();
  }

  async loadUserTeams() {
    const teams = await getBackendSrv().get('/api/user/teams');
    this.setState({ teams });
  }

  render() {
    const { teams } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">Teams</h3>
        <div className="gf-form-group">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => {
                return (
                  <tr key={index}>
                    <td className="width-4 text-center">
                      <img className="filter-table__avatar" src={team.avatarUrl} />
                    </td>
                    <td>{team.name}</td>
                    <td>{team.email}</td>
                    <td>{team.memberCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }
}

export default UserTeams;
