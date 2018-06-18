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

export interface User {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
}

class UserPicker extends Component<IProps, any> {
  debouncedSearch: any;
  backendSrv: any;

  constructor(props) {
    super(props);
    this.state = {};
    this.search = this.search.bind(this);

    this.debouncedSearch = debounce(this.search, 300, {
      leading: true,
      trailing: true,
    });
  }

  search(query?: string) {
    const { toggleLoading, backendSrv } = this.props;

    toggleLoading(true);
    return backendSrv.get(`/api/org/users?query=${query}&limit=10`).then(result => {
      const users = result.map(user => {
        return {
          id: user.userId,
          label: `${user.login} - ${user.email}`,
          avatarUrl: user.avatarUrl,
          login: user.login,
        };
      });
      toggleLoading(false);
      return { options: users };
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
          noResultsText="No users found"
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

export default withPicker(UserPicker);
