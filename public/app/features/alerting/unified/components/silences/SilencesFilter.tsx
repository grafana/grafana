import { css } from '@emotion/css';
import { debounce, uniqueId } from 'lodash';
import React, { FormEvent, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Label, Icon, Input, Tooltip, RadioButtonGroup, useStyles2, Button, Field } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { parseMatchers } from '../../utils/alertmanager';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';

const stateOptions: SelectableValue[] = Object.entries(SilenceState).map(([key, value]) => ({
  label: key,
  value,
}));

const getQueryStringKey = () => uniqueId('query-string-');

export const SilencesFilter = () => {
  const [queryStringKey, setQueryStringKey] = useState(getQueryStringKey());
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString, silenceState } = getSilenceFiltersFromUrlParams(queryParams);
  const styles = useStyles2(getStyles);

  const handleQueryStringChange = debounce((e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setQueryParams({ queryString: target.value || null });
  }, 400);

  const handleSilenceStateChange = (state: string) => {
    setQueryParams({ silenceState: state });
  };

  const clearFilters = () => {
    setQueryParams({
      queryString: null,
      silenceState: null,
    });
    setTimeout(() => setQueryStringKey(getQueryStringKey()));
  };

  const inputInvalid = queryString && queryString.length > 3 ? parseMatchers(queryString).length === 0 : false;

  return (
    <div className={styles.flexRow}>
      <Field
        className={styles.rowChild}
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Search by matchers</span>
              <Tooltip
                content={
                  <div>
                    Filter silences by matchers using a comma separated list of matchers, ie:
                    <pre>{`severity=critical, instance=~cluster-us-.+`}</pre>
                  </div>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
        invalid={inputInvalid}
        error={inputInvalid ? 'Query must use valid matcher syntax' : null}
      >
        <Input
          key={queryStringKey}
          className={styles.searchInput}
          prefix={<Icon name="search" />}
          onChange={handleQueryStringChange}
          defaultValue={queryString ?? ''}
          placeholder="Search"
          data-testid="search-query-input"
        />
      </Field>
      <Field className={styles.rowChild} label="State">
        <RadioButtonGroup options={stateOptions} value={silenceState} onChange={handleSilenceStateChange} />
      </Field>
      {(queryString || silenceState) && (
        <div className={styles.rowChild}>
          <Button variant="secondary" icon="times" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css`
    width: 360px;
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    padding-bottom: ${theme.spacing(2)};
    border-bottom: 1px solid ${theme.colors.border.strong};
  `,
  rowChild: css`
    margin-right: ${theme.spacing(1)};
    margin-bottom: 0;
    max-height: 52px;
  `,
  fieldLabel: css`
    font-size: 12px;
    font-weight: 500;
  `,
});
