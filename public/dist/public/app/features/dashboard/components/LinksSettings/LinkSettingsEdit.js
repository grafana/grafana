import { __assign, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { CollapsableSection, TagsInput, Select, Field, Input, Checkbox } from '@grafana/ui';
export var newLink = {
    icon: 'external link',
    title: 'New link',
    tooltip: '',
    type: 'dashboards',
    url: '',
    asDropdown: false,
    tags: [],
    targetBlank: false,
    keepTime: false,
    includeVars: false,
};
var linkTypeOptions = [
    { value: 'dashboards', label: 'Dashboards' },
    { value: 'link', label: 'Link' },
];
export var linkIconMap = {
    'external link': 'external-link-alt',
    dashboard: 'apps',
    question: 'question-circle',
    info: 'info-circle',
    bolt: 'bolt',
    doc: 'file-alt',
    cloud: 'cloud',
};
var linkIconOptions = Object.keys(linkIconMap).map(function (key) { return ({ label: key, value: key }); });
export var LinkSettingsEdit = function (_a) {
    var editLinkIdx = _a.editLinkIdx, dashboard = _a.dashboard;
    var _b = __read(useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : newLink), 2), linkSettings = _b[0], setLinkSettings = _b[1];
    var onUpdate = function (link) {
        var links = __spreadArray([], __read(dashboard.links), false);
        links.splice(editLinkIdx, 1, link);
        dashboard.links = links;
        setLinkSettings(link);
    };
    var onTagsChange = function (tags) {
        onUpdate(__assign(__assign({}, linkSettings), { tags: tags }));
    };
    var onTypeChange = function (selectedItem) {
        var update = __assign(__assign({}, linkSettings), { type: selectedItem.value });
        // clear props that are no longe revant for this type
        if (update.type === 'dashboards') {
            update.url = '';
            update.tooltip = '';
        }
        else {
            update.tags = [];
        }
        onUpdate(update);
    };
    var onIconChange = function (selectedItem) {
        onUpdate(__assign(__assign({}, linkSettings), { icon: selectedItem.value }));
    };
    var onChange = function (ev) {
        var _a;
        var target = ev.currentTarget;
        onUpdate(__assign(__assign({}, linkSettings), (_a = {}, _a[target.name] = target.type === 'checkbox' ? target.checked : target.value, _a)));
    };
    var isNew = linkSettings.title === newLink.title;
    return (React.createElement("div", { style: { maxWidth: '600px' } },
        React.createElement(Field, { label: "Title" },
            React.createElement(Input, { name: "title", id: "title", value: linkSettings.title, onChange: onChange, autoFocus: isNew })),
        React.createElement(Field, { label: "Type" },
            React.createElement(Select, { inputId: "link-type-input", value: linkSettings.type, options: linkTypeOptions, onChange: onTypeChange, menuShouldPortal: true })),
        linkSettings.type === 'dashboards' && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "With tags" },
                React.createElement(TagsInput, { tags: linkSettings.tags, placeholder: "add tags", onChange: onTagsChange })))),
        linkSettings.type === 'link' && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "URL" },
                React.createElement(Input, { name: "url", value: linkSettings.url, onChange: onChange })),
            React.createElement(Field, { label: "Tooltip" },
                React.createElement(Input, { name: "tooltip", value: linkSettings.tooltip, onChange: onChange, placeholder: "Open dashboard" })),
            React.createElement(Field, { label: "Icon" },
                React.createElement(Select, { menuShouldPortal: true, value: linkSettings.icon, options: linkIconOptions, onChange: onIconChange })))),
        React.createElement(CollapsableSection, { label: "Options", isOpen: true },
            linkSettings.type === 'dashboards' && (React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Show as dropdown", name: "asDropdown", value: linkSettings.asDropdown, onChange: onChange }))),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Include current time range", name: "keepTime", value: linkSettings.keepTime, onChange: onChange })),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Include current template variable values", name: "includeVars", value: linkSettings.includeVars, onChange: onChange })),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Open link in new tab", name: "targetBlank", value: linkSettings.targetBlank, onChange: onChange })))));
};
//# sourceMappingURL=LinkSettingsEdit.js.map