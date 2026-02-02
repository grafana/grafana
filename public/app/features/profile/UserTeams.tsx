import { PureComponent } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { Team } from 'app/types';

export interface Props {
  teams: Team[];
  isLoading: boolean;
}

export class UserTeams extends PureComponent<Props> {
  render() {
    const { isLoading, teams } = this.props;

    if (isLoading) {
      return (
        // BMC Change: Next line
        <LoadingPlaceholder text={t('bmcgrafana.shared-preferences.profile.team.loading-text', 'Loading teams...')} />
      );
    }

    if (teams.length === 0) {
      return null;
    }

    return (
      <div>
        <h3 className="page-sub-heading">
          <Trans i18nKey={'bmcgrafana.users-and-access.teams.title'}>Teams</Trans>
        </h3>
        <table className="filter-table form-inline" aria-label="User teams table">
          <thead>
            <tr>
              <th />
              <th>
                {/* BMC Change: Next line */}
                <Trans i18nKey={'bmcgrafana.users-and-access.headers.name-text'}>Name</Trans>
              </th>
              <th>
                {/* BMC Change: Next line */}
                <Trans i18nKey={'bmcgrafana.users-and-access.headers.email-text'}>Email</Trans>
              </th>
              <th>
                {/* BMC Change: Next line */}
                <Trans i18nKey={'bmcgrafana.users-and-access.headers.members-text'}>Members</Trans>
              </th>
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
    );
  }
}

export default UserTeams;
