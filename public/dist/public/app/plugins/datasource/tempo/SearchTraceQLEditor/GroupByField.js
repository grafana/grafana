import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AccessoryButton } from '@grafana/experimental';
import { HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { TraceqlSearchScope } from '../dataquery.gen';
import InlineSearchField from './InlineSearchField';
import { replaceAt } from './utils';
export const GroupByField = (props) => {
    var _a;
    const { datasource, onChange, query, isTagsLoading } = props;
    const styles = useStyles2(getStyles);
    const generateId = () => uuidv4().slice(0, 8);
    useEffect(() => {
        if (!query.groupBy || query.groupBy.length === 0) {
            onChange(Object.assign(Object.assign({}, query), { groupBy: [
                    {
                        id: generateId(),
                        scope: TraceqlSearchScope.Span,
                    },
                ] }));
        }
    }, [onChange, query]);
    const getTags = (f) => {
        return datasource.languageProvider.getMetricsSummaryTags(f.scope);
    };
    const addFilter = () => {
        updateFilter({
            id: generateId(),
            scope: TraceqlSearchScope.Span,
        });
    };
    const removeFilter = (filter) => {
        var _a;
        onChange(Object.assign(Object.assign({}, query), { groupBy: (_a = query.groupBy) === null || _a === void 0 ? void 0 : _a.filter((f) => f.id !== filter.id) }));
    };
    const updateFilter = (filter) => {
        const copy = Object.assign({}, query);
        copy.groupBy || (copy.groupBy = []);
        const indexOfFilter = copy.groupBy.findIndex((f) => f.id === filter.id);
        if (indexOfFilter >= 0) {
            copy.groupBy = replaceAt(copy.groupBy, indexOfFilter, filter);
        }
        else {
            copy.groupBy.push(filter);
        }
        onChange(copy);
    };
    const scopeOptions = Object.values(TraceqlSearchScope).map((t) => ({ label: t, value: t }));
    return (React.createElement(InlineSearchField, { label: "Aggregate by", tooltip: "Select one or more tags to see the metrics summary. Note: the metrics summary API only considers spans of kind = server." },
        React.createElement(React.Fragment, null, (_a = query.groupBy) === null || _a === void 0 ? void 0 : _a.map((f, i) => {
            var _a, _b, _c;
            return (React.createElement("div", { key: f.id },
                React.createElement(HorizontalGroup, { spacing: 'none', width: 'auto' },
                    React.createElement(Select, { "aria-label": `Select scope for filter ${i + 1}`, onChange: (v) => {
                            updateFilter(Object.assign(Object.assign({}, f), { scope: v === null || v === void 0 ? void 0 : v.value, tag: '' }));
                        }, options: scopeOptions, placeholder: "Select scope", value: f.scope }),
                    React.createElement(Select, { "aria-label": `Select tag for filter ${i + 1}`, isClearable: true, isLoading: isTagsLoading, key: f.tag, onChange: (v) => {
                            updateFilter(Object.assign(Object.assign({}, f), { tag: v === null || v === void 0 ? void 0 : v.value }));
                        }, options: (_a = getTags(f)) === null || _a === void 0 ? void 0 : _a.map((t) => ({
                            label: t,
                            value: t,
                        })), placeholder: "Select tag", value: f.tag || '' }),
                    React.createElement(AccessoryButton, { "aria-label": `Remove tag for filter ${i + 1}`, icon: "times", onClick: () => removeFilter(f), tooltip: "Remove tag", variant: "secondary" }),
                    i === ((_c = (_b = query.groupBy) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) - 1 && (React.createElement("span", { className: styles.addFilter },
                        React.createElement(AccessoryButton, { "aria-label": "Add tag", icon: "plus", onClick: () => addFilter(), tooltip: "Add tag", variant: "secondary" }))))));
        }))));
};
const getStyles = (theme) => ({
    addFilter: css `
    margin-left: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=GroupByField.js.map