import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { Stack } from '@grafana/experimental';
import { Button, Field, Icon, Input, useStyles2 } from '@grafana/ui';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

const ContactPointsFilter = () => {
  const styles = useStyles2(getStyles);

  const [searchParams, setSearchParams] = useURLSearchParams();

  const defaultValue = searchParams.get('search') ?? '';
  const [searchValue, setSearchValue] = useState(defaultValue);

  // update search params, cancel debounce when component is unmounted
  const [, cancel] = useDebounce(
    () => {
      setSearchParams({ search: searchValue }, true);
    },
    300,
    [setSearchParams, searchValue]
  );
  useEffect(() => cancel, [cancel]);

  // clear search input, skip debounce
  const clearFilters = useCallback(() => {
    setSearchParams({ search: '' }, true);
    cancel();
  }, [cancel, setSearchParams]);

  const hasInput = Boolean(defaultValue);

  return (
    <Stack direction="row" alignItems="end" gap={0.5}>
      <Field className={styles.noBottom} label="Search by name or type">
        <Input
          aria-label="search contact points"
          placeholder="Search"
          width={46}
          prefix={<Icon name="search" />}
          onChange={(event) => {
            setSearchValue(event.currentTarget.value);
          }}
          value={searchValue}
        />
      </Field>
      <Button variant="secondary" icon="times" onClick={clearFilters} disabled={!hasInput}>
        Clear
      </Button>
    </Stack>
  );
};

const getStyles = () => ({
  noBottom: css({
    marginBottom: 0,
  }),
});

export { ContactPointsFilter };
