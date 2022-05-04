import React, { PureComponent } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { Team } from 'app/types';

export interface Props {
  teams: Team[];
  isLoading: boolean;
}

export class UserTeams extends PureComponent<Props> {
  render() {
    const { isLoading, teams } = this.props;

    if (isLoading) {
      return <LoadingPlaceholder text="Loading teams..." />;
    }

    if (teams.length === 0) {
      return null;
    }

    return (
      <div>
        <h3 className="page-sub-heading">Teams</h3>
        <div className="gf-form-group">
          <table className="filter-table form-inline" aria-label="User teams table">
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
                      <img className="filter-table__avatar" src={team.avatarUrl} alt="" />
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
      </div>
    );
  }
}

export default UserTeams;
