import React from 'react';

import { AlertManagerPicker } from '../AlertManagerPicker';
import { MatcherFilter } from './MatcherFilter';
import { AlertStateFilter } from './AlertStateFilter';
import { GroupBy } from './GroupBy';
import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { css } from '@emotion/css';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

interface Props {
  groups: AlertmanagerGroup[];
}

export const AlertGroupFilter = ({ groups }: Props) => {
  const [queryParams, setQueryParams] = useQueryParams();
  const { groupBy = [], queryString, alertState } = getFiltersFromUrlParams(queryParams);

  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const styles = useStyles2(getStyles);

  const clearFilters = () => {
    setQueryParams({
      groupBy: null,
      queryString: null,
      alertState: null,
    });
  };

  const showClearButton = !!(groupBy.length > 0 || queryString || alertState);

  return (
    <div className={styles.filterSection}>
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      <MatcherFilter queryString={queryString} onFilterChange={(value) => setQueryParams({ queryString: value })} />
      <GroupBy
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
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filterSection: css`
    display: flex;
    flex-direction: row;
    border-bottom: 1px solid ${theme.colors.border.medium};
    margin-bottom: ${theme.spacing(3)};
  `,
  clearButton: css`
    margin-left: ${theme.spacing(1)};
    margin-top: 19px;
  `,
});
