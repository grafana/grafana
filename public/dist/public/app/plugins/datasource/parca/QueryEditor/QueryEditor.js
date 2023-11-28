import { __awaiter } from "tslib";
import { defaults } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useMount } from 'react-use';
import { CoreApp } from '@grafana/data';
import { ButtonCascader } from '@grafana/ui';
import { defaultParca, defaultParcaQueryType } from '../dataquery.gen';
import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';
export const defaultQuery = Object.assign(Object.assign({}, defaultParca), { queryType: defaultParcaQueryType });
export function QueryEditor(props) {
    const [profileTypes, setProfileTypes] = useState([]);
    function onProfileTypeChange(value, selectedOptions) {
        if (selectedOptions.length === 0) {
            return;
        }
        const id = selectedOptions[selectedOptions.length - 1].value;
        if (typeof id !== 'string') {
            throw new Error('id is not string');
        }
        props.onChange(Object.assign(Object.assign({}, props.query), { profileTypeId: id }));
    }
    function onLabelSelectorChange(value) {
        props.onChange(Object.assign(Object.assign({}, props.query), { labelSelector: value }));
    }
    function handleRunQuery(value) {
        props.onChange(Object.assign(Object.assign({}, props.query), { labelSelector: value }));
        props.onRunQuery();
    }
    useMount(() => __awaiter(this, void 0, void 0, function* () {
        const profileTypes = yield props.datasource.getProfileTypes();
        setProfileTypes(profileTypes);
    }));
    // Turn profileTypes into cascader options
    const cascaderOptions = useMemo(() => {
        var _a, _b;
        let mainTypes = new Map();
        // Classify profile types by name then sample type.
        for (let profileType of profileTypes) {
            if (!mainTypes.has(profileType.name)) {
                mainTypes.set(profileType.name, {
                    label: profileType.name,
                    value: profileType.ID,
                    children: [],
                });
            }
            (_b = (_a = mainTypes.get(profileType.name)) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.push({
                label: profileType.sample_type,
                value: profileType.ID,
            });
        }
        return Array.from(mainTypes.values());
    }, [profileTypes]);
    const selectedProfileName = useMemo(() => {
        if (!profileTypes) {
            return 'Loading';
        }
        const profile = profileTypes.find((type) => type.ID === props.query.profileTypeId);
        if (!profile) {
            return 'Select a profile type';
        }
        return profile.name + ' - ' + profile.sample_type;
    }, [props.query.profileTypeId, profileTypes]);
    let query = normalizeQuery(props.query, props.app);
    return (React.createElement(EditorRows, null,
        React.createElement(EditorRow, { stackProps: { wrap: false, gap: 1 } },
            React.createElement(ButtonCascader, { onChange: onProfileTypeChange, options: cascaderOptions, buttonProps: { variant: 'secondary' } }, selectedProfileName),
            React.createElement(LabelsEditor, { value: query.labelSelector, onChange: onLabelSelectorChange, datasource: props.datasource, onRunQuery: handleRunQuery })),
        React.createElement(EditorRow, null,
            React.createElement(QueryOptions, { query: query, onQueryTypeChange: (val) => {
                    props.onChange(Object.assign(Object.assign({}, query), { queryType: val }));
                }, app: props.app }))));
}
function normalizeQuery(query, app) {
    let normalized = defaults(query, defaultQuery);
    if (app !== CoreApp.Explore && normalized.queryType === 'both') {
        // In dashboards and other places, we can't show both types of graphs at the same time.
        // This will also be a default when having 'both' query and adding it from explore to dashboard
        normalized.queryType = 'profile';
    }
    return normalized;
}
//# sourceMappingURL=QueryEditor.js.map