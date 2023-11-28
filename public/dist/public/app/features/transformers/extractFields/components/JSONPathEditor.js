import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { Button, InlineField, InlineFieldRow, IconButton, Input } from '@grafana/ui';
export function JSONPathEditor({ options, onChange }) {
    const [paths, setPaths] = useState(options);
    const tooltips = getTooltips();
    const style = getStyle();
    const addJSONPath = () => {
        paths.push({ path: '' });
        setPaths([...paths]);
        onBlur();
    };
    const removeJSONPath = (keyPath) => {
        if (paths) {
            paths.splice(keyPath, 1);
            setPaths([...paths]);
            onBlur();
        }
    };
    const onJSONPathChange = (event, keyPath, type) => {
        var _a, _b;
        if (paths) {
            if (type === 'alias') {
                paths[keyPath].alias = (_a = event.currentTarget.value) !== null && _a !== void 0 ? _a : '';
            }
            else {
                paths[keyPath].path = (_b = event.currentTarget.value) !== null && _b !== void 0 ? _b : '';
            }
            setPaths([...paths]);
        }
    };
    const onBlur = () => {
        onChange(paths);
    };
    return (React.createElement("ol", { className: cx(style.list) },
        paths &&
            paths.map((path, key) => (React.createElement("li", { key: key },
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Field", tooltip: tooltips.field, grow: true },
                        React.createElement(Input, { onBlur: onBlur, onChange: (event) => onJSONPathChange(event, key, 'path'), value: path.path, placeholder: 'A valid json path, e.g. "object.value1" or "object.value2[0]"' })),
                    React.createElement(InlineField, { label: "Alias", tooltip: tooltips.alias },
                        React.createElement(Input, { width: 12, value: path.alias, onBlur: onBlur, onChange: (event) => onJSONPathChange(event, key, 'alias') })),
                    React.createElement(InlineField, { className: cx(style.removeIcon) },
                        React.createElement(IconButton, { onClick: () => removeJSONPath(key), name: 'trash-alt', tooltip: "Remove path" })))))),
        React.createElement(InlineField, null,
            React.createElement(Button, { icon: 'plus', onClick: () => addJSONPath(), variant: 'secondary' }, "Add path"))));
}
const getTooltips = () => {
    const mapValidPaths = [
        { path: 'object', description: '=> extract fields from object' },
        { path: 'object.value1', description: '=> extract value1' },
        { path: 'object.value2', description: '=> extract value2' },
        { path: 'object.value2[0]', description: '=> extract value2 first element' },
        { path: 'object.value2[1]', description: '=> extract value2 second element' },
    ];
    return {
        field: (React.createElement("div", null,
            "A valid path of an json object.",
            React.createElement("div", null,
                React.createElement("strong", null, "JSON Value:")),
            React.createElement("pre", null,
                React.createElement("code", null, ['{', '  "object": {', '    "value1": "hello world"', '    "value2": [1, 2, 3, 4]', '  }', '}'].join('\n'))),
            React.createElement("strong", null, "Valid Paths:"),
            mapValidPaths.map((value, key) => {
                return (React.createElement("p", { key: key },
                    React.createElement("code", null, value.path),
                    React.createElement("i", null, value.description)));
            }))),
        alias: 'An alias name for the variable in the dashboard. If left blank the given path will be used.',
    };
};
function getStyle() {
    return {
        list: css `
      margin-left: 20px;
    `,
        removeIcon: css `
      margin: 0 0 0 4px;
      align-items: center;
    `,
    };
}
//# sourceMappingURL=JSONPathEditor.js.map