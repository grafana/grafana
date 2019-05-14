import React, { Component } from 'react';
import _ from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface Team {
  id: number;
  label: string;
  name: string;
  avatarUrl: string;
}

export interface Props {
  onSelected: (team: Team) => void;
  className?: string;
}

export interface State {
  isLoading: boolean;
}

export class TeamPicker extends Component<Props, State> {
  debouncedSearch: any;

  constructor(props: Props) {
    super(props);
    this.state = { isLoading: false };
    this.search = this.search.bind(this);

    this.debouncedSearch = debounce(this.search, 300, {
      leading: true,
      trailing: true,
    });
  }

  search(query?: string) {
    const backendSrv = getBackendSrv();
    this.setState({ isLoading: true });

    if (_.isNil(query)) {
      query = '';
    }

    return backendSrv.get(`/api/teams/search?perpage=10&page=1&query=${query}`).then((result: any) => {
      const teams = result.teams.map((team: any) => {
        return {
          id: team.id,
          value: team.id,
          label: team.name,
          name: team.name,
          imgUrl: team.avatarUrl,
        };
      });

      this.setState({ isLoading: false });
      return teams;
    });
  }

  render() {
    const { onSelected, className } = this.props;
    const { isLoading } = this.state;
    return (
      <div className="user-picker">
        <AsyncSelect
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          className={className}
          placeholder="Select a team"
          noOptionsMessage={() => 'No teams found'}
        />
      </div>
    );
  }
}
