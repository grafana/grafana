import { __awaiter } from "tslib";
import debounce from 'debounce-promise';
import { has, size } from 'lodash';
import React, { useState } from 'react';
import { toOption } from '@grafana/data';
import { Select, InlineFormLabel, Icon, clearButtonStyles, useStyles2, AsyncSelect } from '@grafana/ui';
export function TagSection({ query, onChange, onRunQuery, suggestTagKeys, suggestTagValues, tsdbVersion, }) {
    const buttonStyles = useStyles2(clearButtonStyles);
    const [tagKeys, updTagKeys] = useState();
    const [keyIsLoading, updKeyIsLoading] = useState();
    const [addTagMode, updAddTagMode] = useState(false);
    const [curTagKey, updCurTagKey] = useState('');
    const [curTagValue, updCurTagValue] = useState('');
    const [errors, setErrors] = useState('');
    function changeAddTagMode() {
        updAddTagMode(!addTagMode);
    }
    function addTag() {
        if (query.filters && size(query.filters) > 0) {
            const err = 'Please remove filters to use tags, tags and filters are mutually exclusive.';
            setErrors(err);
            return;
        }
        if (!addTagMode) {
            updAddTagMode(true);
            return;
        }
        // check for duplicate tags
        if (query.tags && has(query.tags, curTagKey)) {
            const err = "Duplicate tag key '" + curTagKey + "'.";
            setErrors(err);
            return;
        }
        // tags may be undefined
        if (!query.tags) {
            query.tags = {};
        }
        // add tag to query
        query.tags[curTagKey] = curTagValue;
        // reset the inputs
        updCurTagKey('');
        updCurTagValue('');
        // fire the query
        onChange(query);
        onRunQuery();
        // close the tag ditor
        changeAddTagMode();
    }
    function removeTag(key) {
        delete query.tags[key];
        // fire off the query
        onChange(query);
        onRunQuery();
    }
    function editTag(key, value) {
        removeTag(key);
        updCurTagKey(key);
        updCurTagValue(value);
        addTag();
    }
    const tagValueSearch = debounce((query) => suggestTagValues(query), 350);
    return (React.createElement("div", { className: "gf-form-inline", "data-testid": testIds.section },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 8, tooltip: tsdbVersion >= 2 ? React.createElement("div", null, "Please use filters, tags are deprecated in opentsdb 2.2") : undefined }, "Tags"),
            query.tags &&
                Object.keys(query.tags).map((tagKey, idx) => {
                    const tagValue = query.tags[tagKey];
                    return (React.createElement(InlineFormLabel, { key: idx, width: "auto", "data-testid": testIds.list + idx },
                        tagKey,
                        "=",
                        tagValue,
                        React.createElement("button", { type: "button", className: buttonStyles, onClick: () => editTag(tagKey, tagValue) },
                            React.createElement(Icon, { name: 'pen' })),
                        React.createElement("button", { type: "button", className: buttonStyles, onClick: () => removeTag(tagKey), "data-testid": testIds.remove },
                            React.createElement(Icon, { name: 'times' }))));
                }),
            !addTagMode && (React.createElement("button", { className: "gf-form-label", type: "button", onClick: changeAddTagMode, "aria-label": "Add tag" },
                React.createElement(Icon, { name: 'plus' })))),
        addTagMode && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(Select, { inputId: "opentsdb-suggested-tagk-select", className: "gf-form-input", value: curTagKey ? toOption('' + curTagKey) : undefined, placeholder: "key", allowCustomValue: true, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
                        updKeyIsLoading(true);
                        const tKs = yield suggestTagKeys(query);
                        const tKsOptions = tKs.map((value) => toOption(value));
                        updTagKeys(tKsOptions);
                        updKeyIsLoading(false);
                    }), isLoading: keyIsLoading, options: tagKeys, onChange: ({ value }) => {
                        if (value) {
                            updCurTagKey(value);
                        }
                    } })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(AsyncSelect, { inputId: "opentsdb-suggested-tagv-select", className: "gf-form-input", value: curTagValue ? toOption(curTagValue) : undefined, placeholder: "value", allowCustomValue: true, loadOptions: tagValueSearch, defaultOptions: [], onChange: ({ value }) => {
                        if (value) {
                            updCurTagValue(value);
                        }
                    } })),
            React.createElement("div", { className: "gf-form" },
                errors && (React.createElement("div", { className: "gf-form-label", title: errors, "data-testid": testIds.error },
                    React.createElement(Icon, { name: 'exclamation-triangle', color: 'rgb(229, 189, 28)' }))),
                React.createElement("div", { className: "gf-form-label" },
                    React.createElement("button", { type: "button", className: buttonStyles, onClick: addTag }, "add tag"),
                    React.createElement("button", { type: "button", className: buttonStyles, onClick: changeAddTagMode },
                        React.createElement(Icon, { name: 'times' })))))),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
}
export const testIds = {
    section: 'opentsdb-tag',
    list: 'opentsdb-tag-list',
    error: 'opentsdb-tag-error',
    remove: 'opentsdb-tag-remove',
};
//# sourceMappingURL=TagSection.js.map