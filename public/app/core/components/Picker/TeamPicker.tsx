import React, { Component } from 'react';
import Select from 'react-select';
import PickerOption from './PickerOption';
import withPicker from './withPicker';
import { debounce } from 'lodash';

export interface IProps {
  backendSrv: any;
  isLoading: boolean;
  toggleLoading: any;
  handlePicked: (user) => void;
  value?: string;
  className?: string;
}

export interface Team {
  id: number;
  label: string;
  name: string;
  avatarUrl: string;
}

class TeamPicker extends Component<IProps, any> {
  debouncedSearch: any;
  backendSrv: any;

  constructor(props) {
    super(props);
    this.state = {};
    this.search = this.search.bind(this);

    this.debouncedSearch = debounce(this.search, 300, {
      leading: true,
      trailing: false,
    });
  }

  search(query?: string) {
    const { toggleLoading, backendSrv } = this.props;

    toggleLoading(true);
    return backendSrv.get(`/api/teams/search?perpage=10&page=1&query=${query}`).then(result => {
      const teams = result.teams.map(team => {
        return {
          id: team.id,
          label: team.name,
          name: team.name,
          avatarUrl: team.avatarUrl,
        };
      });

      toggleLoading(false);
      return { options: teams };
    });
  }

  render() {
    const AsyncComponent = this.state.creatable ? Select.AsyncCreatable : Select.Async;
    const { isLoading, handlePicked, value, className } = this.props;

    return (
      <div className="user-picker">
        <AsyncComponent
          valueKey="id"
          multi={false}
          labelKey="label"
          cache={false}
          isLoading={isLoading}
          loadOptions={this.debouncedSearch}
          loadingPlaceholder="Loading..."
          noResultsText="No teams found"
          onChange={handlePicked}
          className={`gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          optionComponent={PickerOption}
          placeholder="Choose"
          value={value}
          autosize={true}
        />
      </div>
    );
  }
}

export default withPicker(TeamPicker);
