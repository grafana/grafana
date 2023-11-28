import React, { useState } from 'react';
import { InlineFormLabel, Input } from '@grafana/ui/src';
export const AnnotationEditor = (props) => {
    var _a, _b, _c, _d, _e;
    const { query, onChange } = props;
    const [eventQuery, setEventQuery] = useState((_a = query.query) !== null && _a !== void 0 ? _a : '');
    const [textColumn, setTextColumn] = useState((_b = query.textColumn) !== null && _b !== void 0 ? _b : '');
    const [tagsColumn, setTagsColumn] = useState((_c = query.tagsColumn) !== null && _c !== void 0 ? _c : '');
    const [timeEndColumn, setTimeEndColumn] = useState((_d = query === null || query === void 0 ? void 0 : query.timeEndColumn) !== null && _d !== void 0 ? _d : '');
    const [titleColumn] = useState((_e = query === null || query === void 0 ? void 0 : query.titleColumn) !== null && _e !== void 0 ? _e : '');
    const updateValue = (key, val) => {
        onChange(Object.assign(Object.assign({}, query), { [key]: val, rawQuery: true, fromAnnotations: true, textEditor: true }));
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 12 }, "InfluxQL Query"),
            React.createElement(Input, { value: eventQuery, onChange: (e) => { var _a; return setEventQuery((_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : ''); }, onBlur: () => updateValue('query', eventQuery), placeholder: "select text from events where $timeFilter limit 1000" })),
        React.createElement(InlineFormLabel, { width: 12, tooltip: React.createElement("div", null, "If your influxdb query returns more than one field you need to specify the column names below. An annotation event is composed of a title, tags, and an additional text field. Optionally you can map the timeEnd column for region annotation usage.") }, "Field mappings"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 12 }, "Text"),
                    React.createElement(Input, { value: textColumn, onChange: (e) => { var _a; return setTextColumn((_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : ''); }, onBlur: () => updateValue('textColumn', textColumn) })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 12 }, "Tags"),
                    React.createElement(Input, { value: tagsColumn, onChange: (e) => { var _a; return setTagsColumn((_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : ''); }, onBlur: () => updateValue('tagsColumn', tagsColumn) })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 12 }, "TimeEnd"),
                    React.createElement(Input, { value: timeEndColumn, onChange: (e) => { var _a; return setTimeEndColumn((_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : ''); }, onBlur: () => updateValue('timeEndColumn', timeEndColumn) })),
                React.createElement("div", { className: "gf-form ng-hide" },
                    React.createElement(InlineFormLabel, { width: 12 }, "Title"),
                    React.createElement(Input, { defaultValue: titleColumn }))))));
};
//# sourceMappingURL=AnnotationEditor.js.map