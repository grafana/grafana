import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsyncFn } from 'react-use';
import { toOption } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { Select, stylesFactory, useTheme2 } from '@grafana/ui';
import { appendTemplateVariables } from '../../../utils/utils';
const wildcardOption = { value: '*', label: '*' };
const excludeCurrentKey = (dimensions, currentKey) => Object.entries(dimensions !== null && dimensions !== void 0 ? dimensions : {}).reduce((acc, [key, value]) => {
    if (key !== currentKey) {
        return Object.assign(Object.assign({}, acc), { [key]: value });
    }
    return acc;
}, {});
export const FilterItem = ({ filter, metricStat: { region, namespace, metricName, dimensions, accountId }, datasource, dimensionKeys, disableExpressions, onChange, onDelete, }) => {
    const dimensionsExcludingCurrentKey = useMemo(() => excludeCurrentKey(dimensions !== null && dimensions !== void 0 ? dimensions : {}, filter.key), [dimensions, filter]);
    const loadDimensionValues = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!filter.key) {
            return [];
        }
        return datasource.resources
            .getDimensionValues({
            dimensionKey: filter.key,
            dimensionFilters: dimensionsExcludingCurrentKey,
            region,
            namespace,
            metricName,
            accountId,
        })
            .then((result) => {
            if (result.length && !disableExpressions && !result.some((o) => o.value === wildcardOption.value)) {
                result.unshift(wildcardOption);
            }
            return appendTemplateVariables(datasource, result);
        });
    });
    const [state, loadOptions] = useAsyncFn(loadDimensionValues, [
        filter.key,
        dimensions,
        region,
        namespace,
        metricName,
        accountId,
    ]);
    const theme = useTheme2();
    const styles = getOperatorStyles(theme);
    return (React.createElement("div", { "data-testid": "cloudwatch-dimensions-filter-item" },
        React.createElement(InputGroup, null,
            React.createElement(Select, { "aria-label": "Dimensions filter key", inputId: "cloudwatch-dimensions-filter-item-key", width: "auto", value: filter.key ? toOption(filter.key) : null, allowCustomValue: true, options: dimensionKeys, onChange: (change) => {
                    if (change.label) {
                        onChange({ key: change.label, value: undefined });
                    }
                } }),
            React.createElement("span", { className: cx(styles.root) }, "="),
            React.createElement(Select, { "aria-label": "Dimensions filter value", inputId: "cloudwatch-dimensions-filter-item-value", onOpenMenu: loadOptions, width: "auto", value: filter.value ? toOption(filter.value) : null, allowCustomValue: true, isLoading: state.loading, options: state.value, onChange: (change) => {
                    if (change.value) {
                        onChange(Object.assign(Object.assign({}, filter), { value: change.value }));
                    }
                } }),
            React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: onDelete, type: "button" }))));
};
const getOperatorStyles = stylesFactory((theme) => ({
    root: css({
        padding: theme.spacing(0, 1),
        alignSelf: 'center',
    }),
}));
//# sourceMappingURL=FilterItem.js.map