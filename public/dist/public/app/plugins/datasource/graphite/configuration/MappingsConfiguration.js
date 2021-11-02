import { __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { Button, Icon, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import MappingsHelp from './MappingsHelp';
export var MappingsConfiguration = function (props) {
    var _a = __read(useState(props.mappings || []), 2), mappings = _a[0], setMappings = _a[1];
    return (React.createElement("div", null,
        React.createElement("h3", { className: "page-heading" }, "Label mappings"),
        !props.showHelp && (React.createElement("p", null,
            React.createElement(Button, { variant: "link", onClick: props.onRestoreHelp }, "Learn how label mappings work"))),
        props.showHelp && React.createElement(MappingsHelp, { onDismiss: props.onDismiss }),
        React.createElement("div", { className: "gf-form-group" },
            mappings.map(function (mapping, i) { return (React.createElement(InlineFieldRow, { key: i },
                React.createElement(InlineField, { label: "Mapping (" + (i + 1) + ")" },
                    React.createElement(Input, { width: 50, onChange: function (changeEvent) {
                            var newMappings = mappings.concat();
                            newMappings[i] = changeEvent.target.value;
                            setMappings(newMappings);
                        }, onBlur: function () {
                            props.onChange(mappings);
                        }, placeholder: "e.g. test.metric.(labelName).*", value: mapping })),
                React.createElement(Button, { type: "button", "aria-label": "Remove header", variant: "secondary", size: "xs", onClick: function (_) {
                        var newMappings = mappings.concat();
                        newMappings.splice(i, 1);
                        setMappings(newMappings);
                        props.onChange(newMappings);
                    } },
                    React.createElement(Icon, { name: "trash-alt" })))); }),
            React.createElement(Button, { variant: "secondary", icon: "plus", type: "button", onClick: function () {
                    setMappings(__spreadArray(__spreadArray([], __read(mappings), false), [''], false));
                } }, "Add label mapping"))));
};
//# sourceMappingURL=MappingsConfiguration.js.map