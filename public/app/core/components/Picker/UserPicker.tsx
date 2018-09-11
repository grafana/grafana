import React, { Component } from 'react';
import Select from 'react-select';
import PickerOption from './PickerOption';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface Props {
  onSelected: (user: User) => void;
  value?: string;
  className?: string;
}

export interface State {
  isLoading: boolean;
}

export interface User {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
}

export class UserPicker extends Component<Props, State> {
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

    return backendSrv
      .get(`/api/org/users?query=${query}&limit=10`)
      .then(result => {
        return {
          options: result.map(user => ({
            id: user.userId,
            label: `${user.login} - ${user.email}`,
            avatarUrl: user.avatarUrl,
            login: user.login,
          })),
        };
      })
      .finally(() => {
        this.setState({ isLoading: false });
      });
  }

  render() {
    const { value, className } = this.props;
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
          noResultsText="No users found"
          onChange={this.props.onSelected}
          className={`gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          optionComponent={PickerOption}
          placeholder="Select user"
          value={value}
          autosize={true}
        />
      </div>
    );
  }
}
