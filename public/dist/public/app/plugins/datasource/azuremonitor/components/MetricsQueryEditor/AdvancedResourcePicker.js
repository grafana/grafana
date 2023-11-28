import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { AccessoryButton } from '@grafana/experimental';
import { Input, Label, InlineField, Button, useStyles2 } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
const getStyles = (theme) => ({
    resourceList: css({ display: 'flex', columnGap: theme.spacing(1), flexWrap: 'wrap', marginBottom: theme.spacing(1) }),
    resource: css({ flex: '0 0 auto' }),
    resourceLabel: css({ padding: theme.spacing(1) }),
    resourceGroupAndName: css({ display: 'flex', columnGap: theme.spacing(0.5) }),
});
const AdvancedResourcePicker = ({ resources, onChange }) => {
    var _a, _b, _c, _d, _e, _f;
    const styles = useStyles2(getStyles);
    useEffect(() => {
        // Ensure there is at least one resource
        if (resources.length === 0) {
            onChange([{}]);
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
        var _a, _b;
        onChange(resources.concat({
            subscription: (_a = resources[0]) === null || _a === void 0 ? void 0 : _a.subscription,
            metricNamespace: (_b = resources[0]) === null || _b === void 0 ? void 0 : _b.metricNamespace,
            resourceGroup: '',
            resourceName: '',
        }));
    };
    const onCommonPropChange = (r) => {
        onChange(resources.map((resource) => (Object.assign(Object.assign({}, resource), r))));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Subscription", grow: true, transparent: true, htmlFor: `input-advanced-resource-picker-subscription`, labelWidth: 15, "data-testid": selectors.components.queryEditor.resourcePicker.advanced.subscription.input },
            React.createElement(Input, { id: `input-advanced-resource-picker-subscription`, value: (_b = (_a = resources[0]) === null || _a === void 0 ? void 0 : _a.subscription) !== null && _b !== void 0 ? _b : '', onChange: (event) => onCommonPropChange({ subscription: event.currentTarget.value }), placeholder: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeee" })),
        React.createElement(InlineField, { label: "Namespace", grow: true, transparent: true, htmlFor: `input-advanced-resource-picker-metricNamespace`, labelWidth: 15, "data-testid": selectors.components.queryEditor.resourcePicker.advanced.namespace.input },
            React.createElement(Input, { id: `input-advanced-resource-picker-metricNamespace`, value: (_d = (_c = resources[0]) === null || _c === void 0 ? void 0 : _c.metricNamespace) !== null && _d !== void 0 ? _d : '', onChange: (event) => onCommonPropChange({ metricNamespace: event.currentTarget.value }), placeholder: "Microsoft.Insights/metricNamespaces" })),
        React.createElement(InlineField, { label: "Region", grow: true, transparent: true, htmlFor: `input-advanced-resource-picker-region`, labelWidth: 15, "data-testid": selectors.components.queryEditor.resourcePicker.advanced.region.input, tooltip: "The code region of the resource. Optional for one resource but mandatory when selecting multiple ones." },
            React.createElement(Input, { id: `input-advanced-resource-picker-region`, value: (_f = (_e = resources[0]) === null || _e === void 0 ? void 0 : _e.region) !== null && _f !== void 0 ? _f : '', onChange: (event) => onCommonPropChange({ region: event.currentTarget.value }), placeholder: "northeurope" })),
        React.createElement("div", { className: styles.resourceList }, resources.map((resource, index) => {
            var _a, _b;
            return (React.createElement("div", { key: `resource-${index + 1}`, className: styles.resource },
                resources.length !== 1 && React.createElement(Label, { className: styles.resourceLabel },
                    "Resource ",
                    index + 1),
                React.createElement(InlineField, { label: "Resource Group", transparent: true, htmlFor: `input-advanced-resource-picker-resourceGroup-${index + 1}`, labelWidth: 15, "data-testid": selectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input },
                    React.createElement("div", { className: styles.resourceGroupAndName },
                        React.createElement(Input, { id: `input-advanced-resource-picker-resourceGroup-${index + 1}`, value: (_a = resource === null || resource === void 0 ? void 0 : resource.resourceGroup) !== null && _a !== void 0 ? _a : '', onChange: (event) => onResourceChange(index, Object.assign(Object.assign({}, resource), { resourceGroup: event.currentTarget.value })), placeholder: "resource-group" }),
                        React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => removeResource(index), hidden: resources.length === 1, "data-testid": 'remove-resource' }))),
                React.createElement(InlineField, { label: "Resource Name", transparent: true, htmlFor: `input-advanced-resource-picker-resourceName-${index + 1}`, labelWidth: 15, "data-testid": selectors.components.queryEditor.resourcePicker.advanced.resource.input },
                    React.createElement(Input, { id: `input-advanced-resource-picker-resourceName-${index + 1}`, value: (_b = resource === null || resource === void 0 ? void 0 : resource.resourceName) !== null && _b !== void 0 ? _b : '', onChange: (event) => onResourceChange(index, Object.assign(Object.assign({}, resource), { resourceName: event.currentTarget.value })), placeholder: "name" }))));
        })),
        React.createElement(Button, { "aria-label": "Add", icon: "plus", variant: "secondary", onClick: addResource, type: "button" }, "Add resource")));
};
export default AdvancedResourcePicker;
//# sourceMappingURL=AdvancedResourcePicker.js.map