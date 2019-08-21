import React, { PureComponent } from 'react';
import { Team } from 'app/types';

export interface Props {
  teams: Team[];
  isLoading: boolean;
  loadTeams: () => void;
}

export class UserTeams extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadTeams();
  }

  render() {
    const { isLoading, teams } = this.props;
    const showTeams = !isLoading && teams.length > 0;

    return (
      <>
        {showTeams && (
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
                  {teams.map((team: Team, index) => {
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
        )}
      </>
    );
  }
}

export default UserTeams;
