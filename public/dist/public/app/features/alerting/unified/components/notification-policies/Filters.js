import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, Field, Icon, Input, Label as LabelElement, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { matcherToObjectMatcher, parseMatchers } from '../../utils/alertmanager';
const NotificationPoliciesFilter = ({ receivers, onChangeReceiver, onChangeMatchers, }) => {
    var _a;
    const [searchParams, setSearchParams] = useURLSearchParams();
    const searchInputRef = useRef(null);
    const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);
    const styles = useStyles2(getStyles);
    const handleChangeLabels = useCallback(() => debounce(onChangeMatchers, 500), [onChangeMatchers]);
    useEffect(() => {
        onChangeReceiver(contactPoint);
    }, [contactPoint, onChangeReceiver]);
    useEffect(() => {
        const matchers = parseMatchers(queryString !== null && queryString !== void 0 ? queryString : '').map(matcherToObjectMatcher);
        handleChangeLabels()(matchers);
    }, [handleChangeLabels, queryString]);
    const clearFilters = useCallback(() => {
        if (searchInputRef.current) {
            searchInputRef.current.value = '';
        }
        setSearchParams({ contactPoint: undefined, queryString: undefined });
    }, [setSearchParams]);
    const receiverOptions = receivers.map(toOption);
    const selectedContactPoint = (_a = receiverOptions.find((option) => option.value === contactPoint)) !== null && _a !== void 0 ? _a : null;
    const hasFilters = queryString || contactPoint;
    const inputInvalid = queryString && queryString.length > 3 ? parseMatchers(queryString).length === 0 : false;
    return (React.createElement(Stack, { direction: "row", alignItems: "flex-start", gap: 0.5 },
        React.createElement(Field, { className: styles.noBottom, label: React.createElement(LabelElement, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Search by matchers"),
                    React.createElement(Tooltip, { content: React.createElement("div", null,
                            "Filter silences by matchers using a comma separated list of matchers, ie:",
                            React.createElement("pre", null, `severity=critical, instance=~cluster-us-.+`)) },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))), invalid: inputInvalid, error: inputInvalid ? 'Query must use valid matcher syntax' : null },
            React.createElement(Input, { ref: searchInputRef, "data-testid": "search-query-input", placeholder: "Search", width: 46, prefix: React.createElement(Icon, { name: "search" }), onChange: (event) => {
                    setSearchParams({ queryString: event.currentTarget.value });
                }, defaultValue: queryString })),
        React.createElement(Field, { label: "Search by contact point", style: { marginBottom: 0 } },
            React.createElement(Select, { id: "receiver", "aria-label": "Search by contact point", value: selectedContactPoint, options: receiverOptions, onChange: (option) => {
                    setSearchParams({ contactPoint: option === null || option === void 0 ? void 0 : option.value });
                }, width: 28, isClearable: true })),
        hasFilters && (React.createElement(Button, { variant: "secondary", icon: "times", onClick: clearFilters, style: { marginTop: 19 } }, "Clear filters"))));
};
export function findRoutesMatchingPredicate(routeTree, predicateFn) {
    const matches = [];
    function findMatch(route) {
        var _a;
        if (predicateFn(route)) {
            matches.push(route);
        }
        (_a = route.routes) === null || _a === void 0 ? void 0 : _a.forEach(findMatch);
    }
    findMatch(routeTree);
    return matches;
}
const toOption = (receiver) => ({
    label: receiver.name,
    value: receiver.name,
});
const getNotificationPoliciesFilters = (searchParams) => {
    var _a, _b;
    return ({
        queryString: (_a = searchParams.get('queryString')) !== null && _a !== void 0 ? _a : undefined,
        contactPoint: (_b = searchParams.get('contactPoint')) !== null && _b !== void 0 ? _b : undefined,
    });
};
const getStyles = () => ({
    noBottom: css `
    margin-bottom: 0;
  `,
});
export { NotificationPoliciesFilter };
//# sourceMappingURL=Filters.js.map