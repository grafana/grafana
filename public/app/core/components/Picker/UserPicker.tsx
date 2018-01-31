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
      trailing: false,
    });
  }

  search(query?: string) {
    const { toggleLoading, backendSrv } = this.props;

    toggleLoading(true);
    return backendSrv.get(`/api/users/search?perpage=10&page=1&query=${query}`).then(result => {
      const users = result.users.map(user => {
        return {
          id: user.id,
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
    const { isLoading, handlePicked, value } = this.props;
    console.log('value', value);
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
          className="width-12 gf-form-input gf-form-input--form-dropdown"
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
