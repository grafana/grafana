import debounce from 'debounce-promise';
import { isNil } from 'lodash';
import { Component } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { ServiceAccountDTO, ServiceAccountsState } from 'app/types';

export interface Props {
  onSelected: (user: SelectableValue<ServiceAccountDTO>) => void;
  className?: string;
  inputId?: string;
}

export interface State {
  isLoading: boolean;
}

export class ServiceAccountPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { isLoading: false };
  }

  search = debounce(
    async (query?: string) => {
      this.setState({ isLoading: true });

      if (isNil(query)) {
        query = '';
      }

      return getBackendSrv()
        .get(`/api/serviceaccounts/search?query=${query}&perpage=100`)
        .then((result: ServiceAccountsState) => {
          return result.serviceAccounts.map((sa) => ({
            id: sa.id,
            uid: sa.uid,
            value: sa,
            label: sa.login,
            imgUrl: sa.avatarUrl,
            login: sa.login,
          }));
        })
        .finally(() => {
          this.setState({ isLoading: false });
        });
    },
    300,
    { leading: true }
  );

  render() {
    const { className, onSelected, inputId } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="service-account-picker" data-testid="serviceAccountPicker">
        <AsyncSelect
          isClearable
          className={className}
          inputId={inputId}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.search}
          onChange={onSelected}
          placeholder="Start typing to search for service accounts"
          noOptionsMessage="No service accounts found"
          aria-label="Service Account picker"
        />
      </div>
    );
  }
}
