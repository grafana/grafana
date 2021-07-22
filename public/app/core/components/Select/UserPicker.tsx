// Libraries
import React, { Component } from 'react';
import { debounce, isNil } from 'lodash';

// Components
import { AsyncSelect } from '@grafana/ui';

// Utils & Services
import { getBackendSrv } from '@grafana/runtime';

// Types
import { OrgUser } from 'app/types';
import { SelectableValue } from '@grafana/data';

export interface Props {
  onSelected: (user: SelectableValue<OrgUser['userId']>) => void;
  className?: string;
}

export interface State {
  isLoading: boolean;
}

export class UserPicker extends Component<Props, State> {
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
    this.setState({ isLoading: true });

    if (isNil(query)) {
      query = '';
    }

    return getBackendSrv()
      .get(`/api/org/users/lookup?query=${query}&limit=100`)
      .then((result: OrgUser[]) => {
        return result.map((user) => ({
          id: user.userId,
          value: user.userId,
          label: user.login,
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
      <div className="user-picker" data-testid="userPicker">
        <AsyncSelect
          isClearable
          className={className}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          placeholder="Start typing to search for user"
          noOptionsMessage="No users found"
        />
      </div>
    );
  }
}
