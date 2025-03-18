import { debounce, DebouncedFuncLeading, isNil } from 'lodash';
import { Component } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { Team } from 'app/types';

export interface Props {
  onSelected: (team: SelectableValue<Team>) => void;
  className?: string;
  teamId?: number;
}

export interface State {
  isLoading: boolean;
  value?: SelectableValue<Team>;
}

export class TeamPicker extends Component<Props, State> {
  debouncedSearch: DebouncedFuncLeading<typeof this.search>;

  constructor(props: Props) {
    super(props);
    this.state = { isLoading: false };
    this.search = this.search.bind(this);

    this.debouncedSearch = debounce(this.search, 300, {
      leading: true,
      trailing: true,
    });
  }

  componentDidMount(): void {
    const { teamId } = this.props;
    if (!teamId) {
      return;
    }

    getBackendSrv()
      .get(`/api/teams/${teamId}`)
      .then((team: Team) => {
        this.setState({
          value: {
            value: team,
            label: team.name,
            imgUrl: team.avatarUrl,
          },
        });
      });
  }

  search(query?: string) {
    this.setState({ isLoading: true });

    if (isNil(query)) {
      query = '';
    }

    return getBackendSrv()
      .get(`/api/teams/search?perpage=100&page=1&query=${query}`)
      .then((result: { teams: Team[] }) => {
        const teams: Array<SelectableValue<Team>> = result.teams.map((team) => {
          return {
            value: team,
            label: team.name,
            imgUrl: team.avatarUrl,
          };
        });

        this.setState({ isLoading: false });
        return teams;
      });
  }

  render() {
    const { onSelected, className } = this.props;
    const { isLoading, value } = this.state;
    return (
      <div className="user-picker" data-testid="teamPicker">
        <AsyncSelect
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          value={value}
          onChange={onSelected}
          className={className}
          placeholder="Select a team"
          noOptionsMessage="No teams found"
          aria-label="Team picker"
        />
      </div>
    );
  }
}
