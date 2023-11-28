import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { EditorRow } from '@grafana/experimental';
import { config, getTemplateSrv } from '@grafana/runtime';
import { Alert, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { TempoQueryBuilderOptions } from '../traceql/TempoQueryBuilderOptions';
import { traceqlGrammar } from '../traceql/traceql';
import DurationInput from './DurationInput';
import { GroupByField } from './GroupByField';
import InlineSearchField from './InlineSearchField';
import SearchField from './SearchField';
import TagsInput from './TagsInput';
import { filterScopedTag, filterTitle, generateQueryFromFilters, replaceAt } from './utils';
const TraceQLSearch = ({ datasource, query, onChange }) => {
    var _a, _b, _c, _d, _e;
    const styles = useStyles2(getStyles);
    const [error, setError] = useState(null);
    const [isTagsLoading, setIsTagsLoading] = useState(true);
    const [traceQlQuery, setTraceQlQuery] = useState('');
    const templateSrv = getTemplateSrv();
    const updateFilter = useCallback((s) => {
        const copy = Object.assign({}, query);
        copy.filters || (copy.filters = []);
        const indexOfFilter = copy.filters.findIndex((f) => f.id === s.id);
        if (indexOfFilter >= 0) {
            // update in place if the filter already exists, for consistency and to avoid UI bugs
            copy.filters = replaceAt(copy.filters, indexOfFilter, s);
        }
        else {
            copy.filters.push(s);
        }
        onChange(copy);
    }, [onChange, query]);
    const deleteFilter = (s) => {
        onChange(Object.assign(Object.assign({}, query), { filters: query.filters.filter((f) => f.id !== s.id) }));
    };
    useEffect(() => {
        setTraceQlQuery(generateQueryFromFilters(query.filters || []));
    }, [query]);
    const findFilter = useCallback((id) => { var _a; return (_a = query.filters) === null || _a === void 0 ? void 0 : _a.find((f) => f.id === id); }, [query.filters]);
    useEffect(() => {
        const fetchTags = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield datasource.languageProvider.start();
                setIsTagsLoading(false);
            }
            catch (error) {
                if (error instanceof Error) {
                    dispatch(notifyApp(createErrorNotification('Error', error)));
                }
            }
        });
        fetchTags();
    }, [datasource]);
    useEffect(() => {
        var _a, _b;
        // Initialize state with configured static filters that already have a value from the config
        (_b = (_a = datasource.search) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.filter((f) => f.value).forEach((f) => {
            if (!findFilter(f.id)) {
                updateFilter(f);
            }
        });
    }, [(_a = datasource.search) === null || _a === void 0 ? void 0 : _a.filters, findFilter, updateFilter]);
    // filter out tags that already exist in the static fields
    const staticTags = ((_c = (_b = datasource.search) === null || _b === void 0 ? void 0 : _b.filters) === null || _c === void 0 ? void 0 : _c.map((f) => f.tag)) || [];
    staticTags.push('duration');
    // Dynamic filters are all filters that don't match the ID of a filter in the datasource configuration
    // The duration tag is a special case since its selector is hard-coded
    const dynamicFilters = (query.filters || []).filter((f) => { var _a, _b; return f.tag !== 'duration' && (((_b = (_a = datasource.search) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.findIndex((sf) => sf.id === f.id)) || 0) === -1; });
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement("div", null, (_e = (_d = datasource.search) === null || _d === void 0 ? void 0 : _d.filters) === null || _e === void 0 ? void 0 :
                _e.map((f) => f.tag && (React.createElement(InlineSearchField, { key: f.id, label: filterTitle(f), tooltip: `Filter your search by ${filterScopedTag(f)}. To modify the default filters shown for search visit the Tempo datasource configuration page.` },
                    React.createElement(SearchField, { filter: findFilter(f.id) || f, datasource: datasource, setError: setError, updateFilter: updateFilter, tags: [], hideScope: true, hideTag: true, query: traceQlQuery })))),
                React.createElement(InlineSearchField, { label: 'Duration', tooltip: "The span duration, i.e.\tend - start time of the span. Accepted units are ns, ms, s, m, h" },
                    React.createElement(HorizontalGroup, { spacing: 'sm' },
                        React.createElement(DurationInput, { filter: findFilter('min-duration') || {
                                id: 'min-duration',
                                tag: 'duration',
                                operator: '>',
                                valueType: 'duration',
                            }, operators: ['>', '>='], updateFilter: updateFilter }),
                        React.createElement(DurationInput, { filter: findFilter('max-duration') || {
                                id: 'max-duration',
                                tag: 'duration',
                                operator: '<',
                                valueType: 'duration',
                            }, operators: ['<', '<='], updateFilter: updateFilter }))),
                React.createElement(InlineSearchField, { label: 'Tags' },
                    React.createElement(TagsInput, { filters: dynamicFilters, datasource: datasource, setError: setError, updateFilter: updateFilter, deleteFilter: deleteFilter, staticTags: staticTags, isTagsLoading: isTagsLoading, query: traceQlQuery })),
                config.featureToggles.metricsSummary && (React.createElement(GroupByField, { datasource: datasource, onChange: onChange, query: query, isTagsLoading: isTagsLoading }))),
            React.createElement(EditorRow, null,
                React.createElement(RawQuery, { query: templateSrv.replace(traceQlQuery), lang: { grammar: traceqlGrammar, name: 'traceql' } })),
            React.createElement(TempoQueryBuilderOptions, { onChange: onChange, query: query })),
        error ? (React.createElement(Alert, { title: "Unable to connect to Tempo search", severity: "info", className: styles.alert },
            "Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can configure it in the ",
            React.createElement("a", { href: `/datasources/edit/${datasource.uid}` }, "datasource settings"),
            ".")) : null));
};
export default TraceQLSearch;
const getStyles = (theme) => ({
    alert: css `
    max-width: 75ch;
    margin-top: ${theme.spacing(2)};
  `,
    container: css `
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    flex-direction: column;
  `,
});
//# sourceMappingURL=TraceQLSearch.js.map