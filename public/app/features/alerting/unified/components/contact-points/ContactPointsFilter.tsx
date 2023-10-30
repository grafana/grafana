import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useRef } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Field, Icon, Input, Tooltip, Label, useStyles2 } from '@grafana/ui';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

interface ContactPointsFilterProps {}

const ContactPointsFilter = ({}: ContactPointsFilterProps) => {
  const [searchParams, setSearchParams] = useURLSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const styles = useStyles2(getStyles);

  const setSearchParamsDebounced = useMemo(() => debounce(setSearchParams, 300), [setSearchParams]);

  const clearFilters = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchParams({ search: undefined });
  }, [setSearchParams]);

  const defaultValue = searchParams?.get('search') ?? '';
  const hasFilters = Boolean(defaultValue);

  return (
    <Stack direction="row" alignItems="end" gap={0.5}>
      <Field
        className={styles.noBottom}
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Search by name or type</span>
              <Tooltip content={<div>Filter contact points by name or type</div>}>
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
      >
        <Input
          ref={searchInputRef}
          data-testid="search-query-input"
          placeholder="Search"
          width={46}
          prefix={<Icon name="search" />}
          onChange={(event) => {
            setSearchParamsDebounced({
              search: event.currentTarget.value,
            });
          }}
          defaultValue={defaultValue}
        />
      </Field>
      <Button variant="secondary" icon="times" onClick={clearFilters} disabled={!hasFilters}>
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
