import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { AccessoryButton } from '@grafana/experimental';
import { Icon, Input, Tooltip, Label, Button, useStyles2 } from '@grafana/ui';
const getStyles = (theme) => ({
    resourceList: css({ width: '100%', display: 'flex', marginBlock: theme.spacing(1) }),
});
const AdvancedResourcePicker = ({ resources, onChange }) => {
    const styles = useStyles2(getStyles);
    useEffect(() => {
        // Ensure there is at least one resource
        if (resources.length === 0) {
            onChange(['']);
        }
    }, [resources, onChange]);
    const onResourceChange = (index, resource) => {
        const newResources = [...resources];
        newResources[index] = resource;
        onChange(newResources);
    };
    const removeResource = (index) => {
        const newResources = [...resources];
        newResources.splice(index, 1);
        onChange(newResources);
    };
    const addResource = () => {
        onChange(resources.concat(''));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Label, null,
            React.createElement("h6", null,
                "Resource URI(s)",
                ' ',
                React.createElement(Tooltip, { content: React.createElement(React.Fragment, null,
                        "Manually edit the",
                        ' ',
                        React.createElement("a", { href: "https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-standard-columns#_resourceid", rel: "noopener noreferrer", target: "_blank" }, "resource uri"),
                        ". Supports the use of multiple template variables (ex: /subscriptions/$subId/resourceGroups/$rg)"), placement: "right", interactive: true },
                    React.createElement(Icon, { name: "info-circle" })))),
        resources.map((resource, index) => (React.createElement("div", { key: `resource-${index + 1}` },
            React.createElement("div", { className: styles.resourceList },
                React.createElement(Input, { id: `input-advanced-resource-picker-${index + 1}`, value: resource, onChange: (event) => onResourceChange(index, event.currentTarget.value), placeholder: "ex: /subscriptions/$subId", "data-testid": `input-advanced-resource-picker-${index + 1}` }),
                React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => removeResource(index), "data-testid": `remove-resource`, hidden: resources.length === 1 }))))),
        React.createElement(Button, { "aria-label": "Add", icon: "plus", variant: "secondary", onClick: addResource, type: "button" }, "Add resource URI")));
};
export default AdvancedResourcePicker;
//# sourceMappingURL=AdvancedResourcePicker.js.map