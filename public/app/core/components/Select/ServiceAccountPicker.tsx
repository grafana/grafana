import { debounce, isNil } from 'lodash';
import React, { Component } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { ServiceAccount } from 'app/types';

export interface Props {
  onSelected: (serviceAccount: SelectableValue<ServiceAccount>) => void;
  className?: string;
  inputId?: string;
}

export interface State {
  isLoading: boolean;
}

export class ServiceAccountPicker extends Component<Props, State> {
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
      .get(`/api/serviceaccounts/search?query=${query}`)
      .then((result: { serviceAccounts: ServiceAccount[] }) => {
        const serviceAccounts: Array<SelectableValue<ServiceAccount>> = result.serviceAccounts.map((serviceAccount) => {
          return {
            id: serviceAccount.id,
            value: serviceAccount,
            label: serviceAccount.login,
            imgUrl: serviceAccount.avatarUrl,
            login: serviceAccount.login,
          };
        });

        this.setState({ isLoading: false });
        return serviceAccounts;
      });
  }

  render() {
    const { className, onSelected, inputId } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="user-picker" data-testid="serviceAccountPicker">
        <AsyncSelect
          isClearable
          className={className}
          inputId={inputId}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.debouncedSearch}
          onChange={onSelected}
          placeholder="Start typing to search for service accounts"
          noOptionsMessage="No service accounts found"
          aria-label="Service account picker"
        />
      </div>
    );
  }
}
