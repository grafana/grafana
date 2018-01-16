import React, { Component } from 'react';
import { debounce } from 'lodash';
import Select from 'react-select';
import UserPickerOption from './UserPickerOption';

export interface IProps {
  backendSrv: any;
  teamId: string;
  refreshList: any;
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
  teamId: string;
  refreshList: any;

  constructor(props) {
    super(props);
    this.backendSrv = this.props.backendSrv;
    this.teamId = this.props.teamId;
    this.refreshList = this.props.refreshList;

    this.searchUsers = this.searchUsers.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.addUser = this.addUser.bind(this);
    this.toggleLoading = this.toggleLoading.bind(this);

    this.debouncedSearchUsers = debounce(this.searchUsers, 300, {
      leading: true,
      trailing: false,
    });

    this.state = {
      multi: false,
      isLoading: false,
    };
  }

  handleChange(user) {
    this.addUser(user.id);
  }

  toggleLoading(isLoading) {
    this.setState(prevState => {
      return {
        ...prevState,
        isLoading: isLoading,
      };
    });
  }

  addUser(userId) {
    this.toggleLoading(true);
    this.backendSrv.post(`/api/teams/${this.teamId}/members`, { userId: userId }).then(() => {
      this.refreshList();
      this.toggleLoading(false);
    });
  }

  searchUsers(query) {
    this.toggleLoading(true);

    return this.backendSrv.get(`/api/users/search?perpage=10&page=1&query=${query}`).then(result => {
      const users = result.users.map(user => {
        return {
          id: user.id,
          label: `${user.login} - ${user.email}`,
          avatarUrl: user.avatarUrl,
        };
      });
      this.toggleLoading(false);
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
          isLoading={this.state.isLoading}
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

export default UserPicker;
