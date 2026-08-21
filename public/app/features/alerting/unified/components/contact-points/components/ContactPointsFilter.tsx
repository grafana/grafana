import { useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { Field, FilterInput, Stack } from '@grafana/ui';

import { useURLSearchParams } from '../../../hooks/useURLSearchParams';

const ContactPointsFilter = () => {
  const [searchParams, setSearchParams] = useURLSearchParams();

  const defaultValue = searchParams.get('search') ?? '';
  const [searchValue, setSearchValue] = useState(defaultValue);

  const [, cancel] = useDebounce(
    () => {
      setSearchParams({ search: searchValue }, true);
    },
    300,
    [setSearchParams, searchValue]
  );

  return (
    <Stack direction="row" alignItems="end" gap={0.5}>
      <Field
        noMargin
        label={t('alerting.contact-points-filter.label-search-by-name-or-type', 'Search by name or type')}
      >
        <FilterInput
          aria-label={t(
            'alerting.contact-points-filter.aria-label-search-contact-points',
            'Search contact point by name or type'
          )}
          placeholder={t('alerting.contact-points-filter.placeholder-search', 'Search')}
          width={46}
          onChange={(value) => {
            setSearchValue(value);

            if (value === '') {
              cancel();
              setSearchParams({ search: '' }, true);
            }
          }}
          value={searchValue}
        />
      </Field>
    </Stack>
  );
};

export { ContactPointsFilter };
