import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { AlertStateFilter } from './AlertStateFilter';
import { GroupBy } from './GroupBy';
import { MatcherFilter } from './MatcherFilter';
export const AlertGroupFilter = ({ groups }) => {
    const [filterKey, setFilterKey] = useState(Math.floor(Math.random() * 100));
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
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.filterSection },
            React.createElement(MatcherFilter, { className: styles.filterInput, key: matcherFilterKey, defaultQueryString: queryString, onFilterChange: (value) => setQueryParams({ queryString: value ? value : null }) }),
            React.createElement(GroupBy, { className: styles.filterInput, groups: groups, groupBy: groupBy, onGroupingChange: (keys) => setQueryParams({ groupBy: keys.length ? keys.join(',') : null }) }),
            React.createElement(AlertStateFilter, { stateFilter: alertState, onStateFilterChange: (value) => setQueryParams({ alertState: value ? value : null }) }),
            showClearButton && (React.createElement(Button, { className: styles.clearButton, variant: 'secondary', icon: "times", onClick: clearFilters }, "Clear filters")))));
};
const getStyles = (theme) => ({
    wrapper: css `
    border-bottom: 1px solid ${theme.colors.border.medium};
    margin-bottom: ${theme.spacing(3)};
  `,
    filterSection: css `
    display: flex;
    flex-direction: row;
    margin-bottom: ${theme.spacing(3)};
  `,
    filterInput: css `
    width: 340px;
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
    clearButton: css `
    margin-left: ${theme.spacing(1)};
    margin-top: 19px;
  `,
});
//# sourceMappingURL=AlertGroupFilter.js.map