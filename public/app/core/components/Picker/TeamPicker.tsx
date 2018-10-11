import React, { Component } from 'react';
import AsyncSelect from 'react-select/lib/Async';
import PickerOption from './PickerOption';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
import ResetStyles from './ResetStyles';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';

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

  constructor(props) {
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
      return teams;
    });
  }

  render() {
    const { onSelected, className } = this.props;
    const { isLoading } = this.state;
    return (
      <div className="user-picker">
        <AsyncSelect
          classNamePrefix={`gf-form-select-box`}
          isMulti={false}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          className={`gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          styles={ResetStyles}
          components={{
            Option: PickerOption,
            IndicatorsContainer,
            NoOptionsMessage,
          }}
          placeholder="Select a team"
          loadingMessage={() => 'Loading...'}
          noOptionsMessage={() => 'No teams found'}
          getOptionValue={i => i.id}
          getOptionLabel={i => i.label}
        />
      </div>
    );
  }
}
