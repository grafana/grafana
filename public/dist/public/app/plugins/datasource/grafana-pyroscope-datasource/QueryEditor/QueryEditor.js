import deepEqual from 'fast-deep-equal';
import React, { useCallback, useEffect } from 'react';
import { useAsync } from 'react-use';
import { LoadingPlaceholder } from '@grafana/ui';
import { normalizeQuery } from '../datasource';
import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { ProfileTypesCascader, useProfileTypes } from './ProfileTypesCascader';
import { QueryOptions } from './QueryOptions';
export function QueryEditor(props) {
    const { onChange, onRunQuery, datasource, query, range, app } = props;
    function handleRunQuery(value) {
        onChange(Object.assign(Object.assign({}, query), { labelSelector: value }));
        onRunQuery();
    }
    const profileTypes = useProfileTypes(datasource);
    const { labels, getLabelValues, onLabelSelectorChange } = useLabels(range, datasource, query, onChange);
    useNormalizeQuery(query, profileTypes, onChange, app);
    let cascader = React.createElement(LoadingPlaceholder, { text: 'Loading' });
    // The cascader is uncontrolled component so if we want to set some default value we can do it only on initial
    // render, so we are waiting until we have the profileTypes and know what the default value should be before
    // rendering.
    if (profileTypes && query.profileTypeId !== undefined) {
        cascader = (React.createElement(ProfileTypesCascader, { placeholder: profileTypes.length === 0 ? 'No profile types found' : 'Select profile type', profileTypes: profileTypes, initialProfileTypeId: query.profileTypeId, onChange: (val) => {
                onChange(Object.assign(Object.assign({}, query), { profileTypeId: val }));
            } }));
    }
    return (React.createElement(EditorRows, null,
        React.createElement(EditorRow, { stackProps: { wrap: false, gap: 1 } },
            cascader,
            React.createElement(LabelsEditor, { value: query.labelSelector, onChange: onLabelSelectorChange, onRunQuery: handleRunQuery, labels: labels, getLabelValues: getLabelValues })),
        React.createElement(EditorRow, null,
            React.createElement(QueryOptions, { query: query, onQueryChange: props.onChange, app: props.app, labels: labels }))));
}
function useNormalizeQuery(query, profileTypes, onChange, app) {
    useEffect(() => {
        if (!profileTypes) {
            return;
        }
        const normalizedQuery = normalizeQuery(query, app);
        // We just check if profileTypeId is filled but don't check if it's one of the existing cause it can be template
        // variable
        if (!query.profileTypeId) {
            normalizedQuery.profileTypeId = defaultProfileType(profileTypes);
        }
        // Makes sure we don't have an infinite loop updates because the normalization creates a new object
        if (!deepEqual(query, normalizedQuery)) {
            onChange(normalizedQuery);
        }
    }, [app, query, profileTypes, onChange]);
}
function defaultProfileType(profileTypes) {
    var _a;
    const cpuProfiles = profileTypes.filter((p) => p.id.indexOf('cpu') >= 0);
    if (cpuProfiles.length) {
        // Prefer cpu time profile if available instead of samples
        const cpuTimeProfile = cpuProfiles.find((p) => p.id.indexOf('samples') === -1);
        if (cpuTimeProfile) {
            return cpuTimeProfile.id;
        }
        // Fallback to first cpu profile type
        return cpuProfiles[0].id;
    }
    // Fallback to first profile type from response data
    return ((_a = profileTypes[0]) === null || _a === void 0 ? void 0 : _a.id) || '';
}
function useLabels(range, datasource, query, onChange) {
    // Round to nearest 5 seconds. If the range is something like last 1h then every render the range values change slightly
    // and what ever has range as dependency is rerun. So this effectively debounces the queries.
    const unpreciseRange = {
        to: Math.ceil(((range === null || range === void 0 ? void 0 : range.to.valueOf()) || 0) / 5000) * 5000,
        from: Math.floor(((range === null || range === void 0 ? void 0 : range.from.valueOf()) || 0) / 5000) * 5000,
    };
    const labelsResult = useAsync(() => {
        return datasource.getLabelNames(query.profileTypeId + query.labelSelector, unpreciseRange.from, unpreciseRange.to);
    }, [datasource, query.profileTypeId, query.labelSelector, unpreciseRange.to, unpreciseRange.from]);
    // Create a function with range and query already baked in so we don't have to send those everywhere
    const getLabelValues = useCallback((label) => {
        return datasource.getLabelValues(query.profileTypeId + query.labelSelector, label, unpreciseRange.from, unpreciseRange.to);
    }, [query, datasource, unpreciseRange.to, unpreciseRange.from]);
    const onLabelSelectorChange = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, query), { labelSelector: value }));
    }, [onChange, query]);
    return { labels: labelsResult.value, getLabelValues, onLabelSelectorChange };
}
//# sourceMappingURL=QueryEditor.js.map