import { __awaiter } from "tslib";
import React, { useCallback, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { Alert } from '@grafana/ui';
import TagsInput from '../SearchTraceQLEditor/TagsInput';
import { replaceAt } from '../SearchTraceQLEditor/utils';
import { TraceqlSearchScope } from '../dataquery.gen';
import { getErrorMessage } from '../utils';
export function TraceQLSearchTags({ options, onOptionsChange, datasource }) {
    var _a, _b, _c;
    const fetchTags = () => __awaiter(this, void 0, void 0, function* () {
        if (!datasource) {
            throw new Error('Unable to retrieve datasource');
        }
        try {
            yield datasource.languageProvider.start();
        }
        catch (err) {
            // @ts-ignore
            throw new Error(getErrorMessage(err.data.message, 'Unable to query Tempo'));
        }
    });
    const { error, loading } = useAsync(fetchTags, [datasource, options]);
    const updateFilter = useCallback((s) => {
        var _a;
        let copy = (_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.filters;
        copy || (copy = []);
        const indexOfFilter = copy.findIndex((f) => f.id === s.id);
        if (indexOfFilter >= 0) {
            // update in place if the filter already exists, for consistency and to avoid UI bugs
            copy = replaceAt(copy, indexOfFilter, s);
        }
        else {
            copy.push(s);
        }
        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', Object.assign(Object.assign({}, options.jsonData.search), { filters: copy }));
    }, [onOptionsChange, options]);
    const deleteFilter = (s) => {
        var _a, _b;
        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', Object.assign(Object.assign({}, options.jsonData.search), { filters: (_b = (_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.filter((f) => f.id !== s.id) }));
    };
    useEffect(() => {
        var _a;
        if (!((_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.filters)) {
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', Object.assign(Object.assign({}, options.jsonData.search), { filters: [
                    {
                        id: 'service-name',
                        tag: 'service.name',
                        operator: '=',
                        scope: TraceqlSearchScope.Resource,
                    },
                    { id: 'span-name', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
                ] }));
        }
    }, [onOptionsChange, options]);
    // filter out tags that already exist in TraceQLSearch editor
    const staticTags = ['duration'];
    const missingTag = (_b = (_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.find((f) => !f.tag);
    return (React.createElement(React.Fragment, null,
        datasource ? (React.createElement(TagsInput, { updateFilter: updateFilter, deleteFilter: deleteFilter, filters: ((_c = options.jsonData.search) === null || _c === void 0 ? void 0 : _c.filters) || [], datasource: datasource, setError: () => { }, staticTags: staticTags, isTagsLoading: loading, hideValues: true, query: '{}' })) : (React.createElement("div", null, "Invalid data source, please create a valid data source and try again")),
        error && (React.createElement(Alert, { title: 'Unable to fetch TraceQL tags', severity: 'error', topSpacing: 1 }, error.message)),
        missingTag && (React.createElement(Alert, { title: 'Please ensure each filter has a selected tag', severity: 'warning', topSpacing: 1 }))));
}
//# sourceMappingURL=TraceQLSearchTags.js.map