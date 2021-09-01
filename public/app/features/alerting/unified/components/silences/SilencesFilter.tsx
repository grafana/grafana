import React, { useState, FormEvent } from 'react';
import { css } from '@emotion/css';
import { Label, Icon, Input, Tooltip, RadioButtonGroup, useStyles2, Button } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { debounce } from 'lodash';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

export const SilencesFilter = () => {
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const queryStringKey = `queryStringKey-${filterKey}`;
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString, silenceState } = getFiltersFromUrlParams(queryParams);
  const styles = useStyles2(getStyles);

  const handleQueryStringChange = debounce((e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setQueryParams({ queryString: target.value || null });
  }, 600);

  const handleSilenceStateChange = (state: string) => {
    setQueryParams({ silenceState: state });
  };

  const clearFilters = () => {
    setQueryParams({
      queryString: null,
      silenceState: null,
    });
    setTimeout(() => setFilterKey(filterKey + 1), 100);
  };

  const stateOptions: SelectableValue[] = Object.entries(SilenceState).map(([key, value]) => ({
    label: key,
    value,
  }));

  return (
    <div className={styles.flexRow}>
      <div className={styles.rowChild}>
        <Label>
          <Tooltip
            content={
              <div>
                Filter silences by matchers using a comma separated list of matchers, ie:
                <pre>{`severity=critical, instance=~cluster-us-.+`}</pre>
              </div>
            }
          >
            <Icon name="info-circle" />
          </Tooltip>
          Search by matchers
        </Label>
        <Input
          key={queryStringKey}
          className={styles.searchInput}
          prefix={<Icon name="search" />}
          onChange={handleQueryStringChange}
          defaultValue={queryString}
          placeholder="Search"
          data-testid="search-query-input"
        />
      </div>
      <div className={styles.rowChild}>
        <Label>State</Label>
        <RadioButtonGroup options={stateOptions} value={silenceState} onChange={handleSilenceStateChange} />
      </div>
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
  `,
});
