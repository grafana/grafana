import React, { useState } from 'react';
import { InlineFormLabel, Input, TagsInput } from '@grafana/ui';
export const AnnotationEditor = (props) => {
    var _a, _b;
    const { query, onChange } = props;
    const [target, setTarget] = useState((_a = query.target) !== null && _a !== void 0 ? _a : '');
    const [tags, setTags] = useState((_b = query.tags) !== null && _b !== void 0 ? _b : []);
    const updateValue = (key, val) => {
        if (key === 'tags') {
            onChange(Object.assign(Object.assign({}, query), { [key]: val, fromAnnotations: true, queryType: key }));
        }
        else {
            onChange(Object.assign(Object.assign({}, query), { [key]: val, fromAnnotations: true, textEditor: true }));
        }
    };
    const onTagsChange = (tagsInput) => {
        setTags(tagsInput);
        updateValue('tags', tagsInput);
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 12 }, "Graphite Query"),
            React.createElement(Input, { value: target, onChange: (e) => setTarget(e.currentTarget.value || ''), onBlur: () => updateValue('target', target), placeholder: "Example: statsd.application.counters.*.count" })),
        React.createElement("h5", { className: "section-heading" }, "Or"),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 12 }, "Graphite events tags"),
            React.createElement(TagsInput, { id: "tags-input", width: 50, tags: tags, onChange: onTagsChange, placeholder: "Example: event_tag" }))));
};
//# sourceMappingURL=AnnotationsEditor.js.map