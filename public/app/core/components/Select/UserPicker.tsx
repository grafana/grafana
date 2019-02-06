import React, { Component } from 'react';
import AsyncSelect from 'react-select/lib/Async';
import PickerOption from './PickerOption';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { User } from 'app/types';
import ResetStyles from './ResetStyles';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';

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

    return backendSrv
      .get(`/api/org/users?query=${query}&limit=10`)
      .then(result => {
        return result.map(user => ({
          id: user.userId,
          label: user.login === user.email ? user.login : `${user.login} - ${user.email}`,
          avatarUrl: user.avatarUrl,
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
          placeholder="Select user"
          loadingMessage={() => 'Loading...'}
          noOptionsMessage={() => 'No users found'}
          getOptionValue={i => i.id}
          getOptionLabel={i => i.label}
        />
      </div>
    );
  }
}
