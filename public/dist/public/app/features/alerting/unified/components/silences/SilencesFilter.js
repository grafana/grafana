import { css } from '@emotion/css';
import { debounce, uniqueId } from 'lodash';
import React, { useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, Field, Icon, Input, Label, Tooltip, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { parseMatchers } from '../../utils/alertmanager';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';
const getQueryStringKey = () => uniqueId('query-string-');
export const SilencesFilter = () => {
    const [queryStringKey, setQueryStringKey] = useState(getQueryStringKey());
    const [queryParams, setQueryParams] = useQueryParams();
    const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
    const styles = useStyles2(getStyles);
    const handleQueryStringChange = debounce((e) => {
        const target = e.target;
        setQueryParams({ queryString: target.value || null });
    }, 400);
    const clearFilters = () => {
        setQueryParams({
            queryString: null,
            silenceState: null,
        });
        setTimeout(() => setQueryStringKey(getQueryStringKey()));
    };
    const inputInvalid = queryString && queryString.length > 3 ? parseMatchers(queryString).length === 0 : false;
    return (React.createElement("div", { className: styles.flexRow },
        React.createElement(Field, { className: styles.rowChild, label: React.createElement(Label, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Search by matchers"),
                    React.createElement(Tooltip, { content: React.createElement("div", null,
                            "Filter silences by matchers using a comma separated list of matchers, ie:",
                            React.createElement("pre", null, `severity=critical, instance=~cluster-us-.+`)) },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))), invalid: inputInvalid, error: inputInvalid ? 'Query must use valid matcher syntax' : null },
            React.createElement(Input, { key: queryStringKey, className: styles.searchInput, prefix: React.createElement(Icon, { name: "search" }), onChange: handleQueryStringChange, defaultValue: queryString !== null && queryString !== void 0 ? queryString : '', placeholder: "Search", "data-testid": "search-query-input" })),
        queryString && (React.createElement("div", { className: styles.rowChild },
            React.createElement(Button, { variant: "secondary", icon: "times", onClick: clearFilters }, "Clear filters")))));
};
const getStyles = (theme) => ({
    searchInput: css `
    width: 360px;
  `,
    flexRow: css `
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    padding-bottom: ${theme.spacing(3)};
    border-bottom: 1px solid ${theme.colors.border.medium};
  `,
    rowChild: css `
    margin-right: ${theme.spacing(1)};
    margin-bottom: 0;
    max-height: 52px;
  `,
    fieldLabel: css `
    font-size: 12px;
    font-weight: 500;
  `,
});
//# sourceMappingURL=SilencesFilter.js.map