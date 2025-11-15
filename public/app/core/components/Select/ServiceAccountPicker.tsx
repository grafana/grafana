import debounce from 'debounce-promise';
import { isNil } from 'lodash';
import { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { ServiceAccountDTO, ServiceAccountsState } from 'app/types/serviceaccount';

export interface Props {
  onSelected: (user: SelectableValue<ServiceAccountDTO>) => void;
  className?: string;
  inputId?: string;
}

export const ServiceAccountPicker = ({ className, onSelected, inputId }: Props) => {
  const [isLoading, setIsLoading] = useState(false);

  const search = useMemo(
    () =>
      debounce(
        async (query?: string) => {
          setIsLoading(true);

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
              setIsLoading(false);
            });
        },
        300,
        { leading: true }
      ),
    []
  );

  return (
    <div className="service-account-picker" data-testid="serviceAccountPicker">
      <AsyncSelect
        isClearable
        className={className}
        inputId={inputId}
        isLoading={isLoading}
        defaultOptions={true}
        loadOptions={search}
        onChange={onSelected}
        placeholder={t('service-account-picker.select-placeholder', 'Start typing to search for service accounts')}
        noOptionsMessage={t(
          'service-account-picker.noOptionsMessage-no-service-accounts-found',
          'No service accounts found'
        )}
        aria-label={t('service-account-picker.select-aria-label', 'Service account picker')}
      />
    </div>
  );
};
