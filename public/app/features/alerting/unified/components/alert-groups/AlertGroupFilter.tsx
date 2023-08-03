import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';

import { getFiltersFromUrlParams } from '../../utils/misc';

import { AlertStateFilter } from './AlertStateFilter';
import { GroupBy } from './GroupBy';
import { MatcherFilter } from './MatcherFilter';

interface Props {
  groups: AlertmanagerGroup[];
}

export const AlertGroupFilter = ({ groups }: Props) => {
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const [queryParams, setQueryParams] = useQueryParams();
  const { groupBy = [], queryString, alertState } = getFiltersFromUrlParams(queryParams);
  const matcherFilterKey = `matcher-${filterKey}`;

  const styles = useStyles2(getStyles);

  const clearFilters = () => {
    setQueryParams({
      groupBy: null,
      queryString: null,
      alertState: null,
    });
    setTimeout(() => setFilterKey(filterKey + 1), 100);
  };

  const showClearButton = !!(groupBy.length > 0 || queryString || alertState);

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterSection}>
        <MatcherFilter
          className={styles.filterInput}
          key={matcherFilterKey}
          defaultQueryString={queryString}
          onFilterChange={(value) => setQueryParams({ queryString: value ? value : null })}
        />
        <GroupBy
          className={styles.filterInput}
          groups={groups}
          groupBy={groupBy}
          onGroupingChange={(keys) => setQueryParams({ groupBy: keys.length ? keys.join(',') : null })}
        />
        <AlertStateFilter
          stateFilter={alertState as AlertState}
          onStateFilterChange={(value) => setQueryParams({ alertState: value ? value : null })}
        />
        {showClearButton && (
          <Button className={styles.clearButton} variant={'secondary'} icon="times" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    border-bottom: 1px solid ${theme.colors.border.medium};
    margin-bottom: ${theme.spacing(3)};
  `,
  filterSection: css`
    display: flex;
    flex-direction: row;
    margin-bottom: ${theme.spacing(3)};
  `,
  filterInput: css`
    width: 340px;
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
  clearButton: css`
    margin-left: ${theme.spacing(1)};
    margin-top: 19px;
  `,
});
