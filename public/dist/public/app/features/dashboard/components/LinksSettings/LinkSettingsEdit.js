import React, { useState } from 'react';
import { CollapsableSection, TagsInput, Select, Field, Input, Checkbox, Button } from '@grafana/ui';
export const newLink = {
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
const linkTypeOptions = [
    { value: 'dashboards', label: 'Dashboards' },
    { value: 'link', label: 'Link' },
];
export const linkIconMap = {
    'external link': 'external-link-alt',
    dashboard: 'apps',
    question: 'question-circle',
    info: 'info-circle',
    bolt: 'bolt',
    doc: 'file-alt',
    cloud: 'cloud',
};
const linkIconOptions = Object.keys(linkIconMap).map((key) => ({ label: key, value: key }));
export const LinkSettingsEdit = ({ editLinkIdx, dashboard, onGoBack }) => {
    const [linkSettings, setLinkSettings] = useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : newLink);
    const onUpdate = (link) => {
        const links = [...dashboard.links];
        links.splice(editLinkIdx, 1, link);
        dashboard.links = links;
        setLinkSettings(link);
    };
    const onTagsChange = (tags) => {
        onUpdate(Object.assign(Object.assign({}, linkSettings), { tags: tags }));
    };
    const onTypeChange = (selectedItem) => {
        const update = Object.assign(Object.assign({}, linkSettings), { type: selectedItem.value });
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
    const onIconChange = (selectedItem) => {
        onUpdate(Object.assign(Object.assign({}, linkSettings), { icon: selectedItem.value }));
    };
    const onChange = (ev) => {
        const target = ev.currentTarget;
        onUpdate(Object.assign(Object.assign({}, linkSettings), { [target.name]: target.type === 'checkbox' ? target.checked : target.value }));
    };
    const isNew = linkSettings.title === newLink.title;
    return (React.createElement("div", { style: { maxWidth: '600px' } },
        React.createElement(Field, { label: "Title" },
            React.createElement(Input, { name: "title", id: "title", value: linkSettings.title, onChange: onChange, autoFocus: isNew })),
        React.createElement(Field, { label: "Type" },
            React.createElement(Select, { inputId: "link-type-input", value: linkSettings.type, options: linkTypeOptions, onChange: onTypeChange })),
        linkSettings.type === 'dashboards' && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "With tags" },
                React.createElement(TagsInput, { tags: linkSettings.tags, onChange: onTagsChange })))),
        linkSettings.type === 'link' && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "URL" },
                React.createElement(Input, { name: "url", value: linkSettings.url, onChange: onChange })),
            React.createElement(Field, { label: "Tooltip" },
                React.createElement(Input, { name: "tooltip", value: linkSettings.tooltip, onChange: onChange, placeholder: "Open dashboard" })),
            React.createElement(Field, { label: "Icon" },
                React.createElement(Select, { value: linkSettings.icon, options: linkIconOptions, onChange: onIconChange })))),
        React.createElement(CollapsableSection, { label: "Options", isOpen: true },
            linkSettings.type === 'dashboards' && (React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Show as dropdown", name: "asDropdown", value: linkSettings.asDropdown, onChange: onChange }))),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Include current time range", name: "keepTime", value: linkSettings.keepTime, onChange: onChange })),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Include current template variable values", name: "includeVars", value: linkSettings.includeVars, onChange: onChange })),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: "Open link in new tab", name: "targetBlank", value: linkSettings.targetBlank, onChange: onChange }))),
        React.createElement(Button, { onClick: onGoBack }, "Apply")));
};
//# sourceMappingURL=LinkSettingsEdit.js.map