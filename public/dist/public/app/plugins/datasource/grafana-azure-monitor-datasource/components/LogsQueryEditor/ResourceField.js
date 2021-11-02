import { __read } from "tslib";
import { css } from '@emotion/css';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import { parseResourceURI } from '../ResourcePicker/utils';
import { Space } from '../Space';
import { setResource } from './setQueryValue';
function parseResourceDetails(resourceURI) {
    var parsed = parseResourceURI(resourceURI);
    if (!parsed) {
        return undefined;
    }
    return {
        subscriptionName: parsed.subscriptionID,
        resourceGroupName: parsed.resourceGroup,
        resourceName: parsed.resource,
    };
}
var ResourceField = function (_a) {
    var _b;
    var query = _a.query, datasource = _a.datasource, onQueryChange = _a.onQueryChange;
    var styles = useStyles2(getStyles);
    var resource = ((_b = query.azureLogAnalytics) !== null && _b !== void 0 ? _b : {}).resource;
    var _c = __read(useState(false), 2), pickerIsOpen = _c[0], setPickerIsOpen = _c[1];
    var handleOpenPicker = useCallback(function () {
        setPickerIsOpen(true);
    }, []);
    var closePicker = useCallback(function () {
        setPickerIsOpen(false);
    }, []);
    var handleApply = useCallback(function (resourceURI) {
        onQueryChange(setResource(query, resourceURI));
        closePicker();
    }, [closePicker, onQueryChange, query]);
    var templateVariables = datasource.getVariables();
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { className: styles.modal, title: "Select a resource", isOpen: pickerIsOpen, onDismiss: closePicker },
            React.createElement(ResourcePicker, { resourcePickerData: datasource.resourcePickerData, resourceURI: resource, templateVariables: templateVariables, onApply: handleApply, onCancel: closePicker })),
        React.createElement(Field, { label: "Resource" },
            React.createElement(Button, { variant: "secondary", onClick: handleOpenPicker },
                React.createElement(ResourceLabel, { resource: resource, datasource: datasource })))));
};
var ResourceLabel = function (_a) {
    var resource = _a.resource, datasource = _a.datasource;
    var _b = __read(useState(parseResourceDetails(resource !== null && resource !== void 0 ? resource : '')), 2), resourceComponents = _b[0], setResourceComponents = _b[1];
    useEffect(function () {
        if (resource && parseResourceDetails(resource)) {
            datasource.resourcePickerData.getResourceURIDisplayProperties(resource).then(setResourceComponents);
        }
        else {
            setResourceComponents(undefined);
        }
    }, [datasource.resourcePickerData, resource]);
    if (!resource) {
        return React.createElement(React.Fragment, null, "Select a resource");
    }
    if (resourceComponents) {
        return React.createElement(FormattedResource, { resource: resourceComponents });
    }
    if (resource.startsWith('$')) {
        return (React.createElement("span", null,
            React.createElement(Icon, { name: "x" }),
            " ",
            resource));
    }
    return React.createElement(React.Fragment, null, resource);
};
var FormattedResource = function (_a) {
    var resource = _a.resource;
    return (React.createElement("span", null,
        React.createElement(Icon, { name: "layer-group" }),
        " ",
        resource.subscriptionName,
        resource.resourceGroupName && (React.createElement(React.Fragment, null,
            React.createElement(Separator, null),
            React.createElement(Icon, { name: "folder" }),
            " ",
            resource.resourceGroupName)),
        resource.resourceName && (React.createElement(React.Fragment, null,
            React.createElement(Separator, null),
            React.createElement(Icon, { name: "cube" }),
            " ",
            resource.resourceName))));
};
var Separator = function () { return (React.createElement(React.Fragment, null,
    React.createElement(Space, { layout: "inline", h: 2 }),
    '/',
    React.createElement(Space, { layout: "inline", h: 2 }))); };
export default ResourceField;
var getStyles = function (theme) { return ({
    modal: css({
        width: theme.breakpoints.values.lg,
    }),
}); };
//# sourceMappingURL=ResourceField.js.map