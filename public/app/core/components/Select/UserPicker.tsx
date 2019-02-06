// Libraries
import React, { Component } from 'react';
import _ from 'lodash';

// Components
import { AsyncSelect } from '@grafana/ui';

// Utils & Services
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';

// Types
import { User } from 'app/types';

export interface Props {
  onSelected: (user: User) => void;
  className?: string;
}

export interface State {
  isLoading: boolean;
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

    if (_.isNil(query)) {
      query = '';
    }

    return backendSrv
      .get(`/api/org/users?query=${query}&limit=10`)
      .then(result => {
        return result.map(user => ({
          id: user.userId,
          value: user.userId,
          label: user.login === user.email ? user.login : `${user.login} - ${user.email}`,
          imgUrl: user.avatarUrl,
          login: user.login,
        }));
      })
      .finally(() => {
        this.setState({ isLoading: false });
      });
  }

  render() {
    const { className, onSelected } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="user-picker">
        <AsyncSelect
          className={className}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          placeholder="Select user"
          noOptionsMessage={() => 'No users found'}
        />
      </div>
    );
  }
}
