import React, { Component } from 'react';
import Select from 'react-select';
import PickerOption from './PickerOption';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface Props {
  onSelected: (team: Team) => void;
  value?: string;
  className?: string;
}

export interface State {
  isLoading;
}

export interface Team {
  id: number;
  label: string;
  name: string;
  avatarUrl: string;
}

export class TeamPicker extends Component<Props, State> {
  debouncedSearch: any;

  constructor(props) {
    super(props);
    this.state = { isLoading: false };
    this.search = this.search.bind(this);

    this.debouncedSearch = debounce(this.search, 300, {
      leading: true,
      trailing: false,
    });
  }

  search(query?: string) {
    const backendSrv = getBackendSrv();
    this.setState({ isLoading: true });

    return backendSrv.get(`/api/teams/search?perpage=10&page=1&query=${query}`).then(result => {
      const teams = result.teams.map(team => {
        return {
          id: team.id,
          label: team.name,
          name: team.name,
          avatarUrl: team.avatarUrl,
        };
      });

      this.setState({ isLoading: false });
      return { options: teams };
    });
  }

  render() {
    const { onSelected, value, className } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="user-picker">
        <Select.Async
          valueKey="id"
          multi={false}
          labelKey="label"
          cache={false}
          isLoading={isLoading}
          loadOptions={this.debouncedSearch}
          loadingPlaceholder="Loading..."
          noResultsText="No teams found"
          onChange={onSelected}
          className={`gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          optionComponent={PickerOption}
          placeholder="Select a team"
          value={value}
          autosize={true}
        />
      </div>
    );
  }
}
