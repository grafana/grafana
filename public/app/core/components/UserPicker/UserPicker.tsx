import React, { Component } from 'react';
import Select from 'react-select';
import UserPickerOption from './UserPickerOption';
import withPicker from './withPicker';
import { debounce } from 'lodash';

export interface IProps {
  backendSrv: any;
  isLoading: boolean;
  toggleLoading: any;
  userPicked: (user) => void;
}

export interface User {
  id: number;
  name: string;
  login: string;
  email: string;
}

class UserPicker extends Component<IProps, any> {
  debouncedSearchUsers: any;
  backendSrv: any;

  constructor(props) {
    super(props);
    this.state = {};
    this.searchUsers = this.searchUsers.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.debouncedSearchUsers = debounce(this.searchUsers, 300, {
      leading: true,
      trailing: false,
    });
  }

  handleChange(user) {
    const { userPicked } = this.props;
    userPicked(user);
  }

  searchUsers(query) {
    const { toggleLoading, backendSrv } = this.props;

    toggleLoading(true);
    return backendSrv.get(`/api/users/search?perpage=10&page=1&query=${query}`).then(result => {
      const users = result.users.map(user => {
        return {
          id: user.id,
          label: `${user.login} - ${user.email}`,
          avatarUrl: user.avatarUrl,
        };
      });
      toggleLoading(false);
      return { options: users };
    });
  }

  render() {
    const AsyncComponent = this.state.creatable ? Select.AsyncCreatable : Select.Async;

    return (
      <div className="user-picker">
        <AsyncComponent
          valueKey="id"
          multi={this.state.multi}
          labelKey="label"
          cache={false}
          isLoading={this.props.isLoading}
          loadOptions={this.debouncedSearchUsers}
          loadingPlaceholder="Loading..."
          noResultsText="No users found"
          onChange={this.handleChange}
          className="width-8 gf-form-input gf-form-input--form-dropdown"
          optionComponent={UserPickerOption}
          placeholder="Choose"
        />
      </div>
    );
  }
}

export default withPicker(UserPicker);
