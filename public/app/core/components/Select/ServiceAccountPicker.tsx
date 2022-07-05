import { debounce, isNil } from 'lodash';
import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { ServiceAccount } from 'app/types';

export interface Props {
  onSelected: (serviceAccount: SelectableValue<ServiceAccount>) => void;
  className?: string;
  inputId?: string;
  autoFocus?: boolean;
}

export function ServiceAccountPicker({ onSelected, className, inputId, autoFocus }: Props) {
  const [loadingServiceAccounts, setLoadingServiceAccounts] = useState(false);

  // For whatever reason the autoFocus prop doesn't seem to work
  // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
  useEffect(() => {
    if (autoFocus && inputId) {
      document.getElementById(inputId)?.focus();
    }
  }, [autoFocus, inputId]);

  let search = (query?: string) => {
    setLoadingServiceAccounts(true);

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
        setLoadingServiceAccounts(false);
        return serviceAccounts;
      });
  };

  const debouncedSearch = debounce(search, 300, {
    leading: true,
    trailing: true,
  });

  return (
    <AsyncSelect
      inputId={inputId}
      className={className}
      isLoading={loadingServiceAccounts}
      defaultOptions={true}
      isSearchable={true}
      loadOptions={debouncedSearch}
      onChange={onSelected}
      placeholder="Start typing to search for service accounts"
      noOptionsMessage="No service accounts found"
    />
  );
}
