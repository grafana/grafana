import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Label, Tooltip, Input, Icon, useStyles2 } from '@grafana/ui';
import { LogMessages } from '../../Analytics';
export const MatcherFilter = ({ className, onFilterChange, defaultQueryString }) => {
    const styles = useStyles2(getStyles);
    const onSearchInputChanged = useMemo(() => debounce((e) => {
        logInfo(LogMessages.filterByLabel);
        const target = e.currentTarget;
        onFilterChange(target.value);
    }, 600), [onFilterChange]);
    useEffect(() => onSearchInputChanged.cancel(), [onSearchInputChanged]);
    const searchIcon = React.createElement(Icon, { name: 'search' });
    return (React.createElement("div", { className: className },
        React.createElement(Label, null,
            React.createElement(Stack, { gap: 0.5 },
                React.createElement("span", null, "Search by label"),
                React.createElement(Tooltip, { content: React.createElement("div", null,
                        "Filter alerts using label querying, ex:",
                        React.createElement("pre", null, `{severity="critical", instance=~"cluster-us-.+"}`)) },
                    React.createElement(Icon, { className: styles.icon, name: "info-circle", size: "sm" })))),
        React.createElement(Input, { placeholder: "Search", defaultValue: defaultQueryString, onChange: onSearchInputChanged, "data-testid": "search-query-input", prefix: searchIcon, className: styles.inputWidth })));
};
const getStyles = (theme) => ({
    icon: css `
    margin-right: ${theme.spacing(0.5)};
  `,
    inputWidth: css `
    width: 340px;
    flex-grow: 0;
  `,
});
//# sourceMappingURL=MatcherFilter.js.map