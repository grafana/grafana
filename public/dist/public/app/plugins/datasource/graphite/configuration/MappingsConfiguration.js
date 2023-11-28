import React, { useState } from 'react';
import { Button, Icon, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import MappingsHelp from './MappingsHelp';
export const MappingsConfiguration = (props) => {
    const [mappings, setMappings] = useState(props.mappings || []);
    return (React.createElement("div", null,
        React.createElement("h3", { className: "page-heading" }, "Label mappings"),
        !props.showHelp && (React.createElement("p", null,
            React.createElement(Button, { fill: "text", onClick: props.onRestoreHelp }, "Learn how label mappings work"))),
        props.showHelp && React.createElement(MappingsHelp, { onDismiss: props.onDismiss }),
        React.createElement("div", { className: "gf-form-group" },
            mappings.map((mapping, i) => (React.createElement(InlineFieldRow, { key: i },
                React.createElement(InlineField, { label: `Mapping (${i + 1})` },
                    React.createElement(Input, { width: 50, onChange: (changeEvent) => {
                            let newMappings = mappings.concat();
                            newMappings[i] = changeEvent.target.value;
                            setMappings(newMappings);
                        }, onBlur: () => {
                            props.onChange(mappings);
                        }, placeholder: "e.g. test.metric.(labelName).*", value: mapping })),
                React.createElement(Button, { type: "button", "aria-label": "Remove header", variant: "secondary", size: "xs", onClick: (_) => {
                        let newMappings = mappings.concat();
                        newMappings.splice(i, 1);
                        setMappings(newMappings);
                        props.onChange(newMappings);
                    } },
                    React.createElement(Icon, { name: "trash-alt" }))))),
            React.createElement(Button, { variant: "secondary", icon: "plus", type: "button", onClick: () => {
                    setMappings([...mappings, '']);
                } }, "Add label mapping"))));
};
//# sourceMappingURL=MappingsConfiguration.js.map