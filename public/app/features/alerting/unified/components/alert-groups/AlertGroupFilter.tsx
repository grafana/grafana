import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertState, AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { getFiltersFromUrlParams } from '../../utils/misc';

import { AlertStateFilter } from './AlertStateFilter';
import { GroupBy } from './GroupBy';
import { MatcherFilter } from './MatcherFilter';
import { ReceiverFilter } from './ReceiverFilter';

interface Props {
  groups: AlertmanagerGroup[];
}

export const AlertGroupFilter = ({ groups }: Props) => {
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const [queryParams, setQueryParams] = useQueryParams();
  const { groupBy = [], queryString, alertState, receivers = [] } = getFiltersFromUrlParams(queryParams);
  const matcherFilterKey = `matcher-${filterKey}`;

  const styles = useStyles2(getStyles);

  const clearFilters = () => {
    setQueryParams({
      groupBy: null,
      queryString: null,
      alertState: null,
      contactPoint: null,
      receivers: null,
    });
    setTimeout(() => setFilterKey(filterKey + 1), 100);
  };

  const showClearButton = !!(groupBy.length > 0 || queryString || alertState || receivers.length > 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterSection}>
        <MatcherFilter
          key={matcherFilterKey}
          defaultQueryString={queryString}
          onFilterChange={(value) => setQueryParams({ queryString: value ? value : null })}
        />
        <GroupBy
          groups={groups}
          groupBy={groupBy}
          onGroupingChange={(keys) => setQueryParams({ groupBy: keys.length ? keys.join(',') : null })}
        />
        <ReceiverFilter
          groups={groups}
          receivers={receivers}
          onReceiversChange={(receivers) =>
            setQueryParams({ receivers: receivers.length ? receivers.join(',') : null })
          }
        />
        <AlertStateFilter
          stateFilter={alertState as AlertState}
          onStateFilterChange={(value) => setQueryParams({ alertState: value ? value : null })}
        />
        {showClearButton && (
          <Button className={styles.clearButton} variant={'secondary'} icon="times" onClick={clearFilters}>
            <Trans i18nKey="alerting.alert-group-filter.clear-filters">Clear filters</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    marginBottom: theme.spacing(3),
  }),
  filterSection: css({
    display: 'flex',
    flexDirection: 'row',
    marginBottom: theme.spacing(3),
    gap: theme.spacing(1),
  }),
  clearButton: css({
    marginLeft: theme.spacing(1),
    marginTop: '19px',
  }),
});
