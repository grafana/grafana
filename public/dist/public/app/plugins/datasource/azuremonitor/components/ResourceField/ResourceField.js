import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import getStyles from '../ResourcePicker/styles';
import { parseMultipleResourceDetails, setResources } from '../ResourcePicker/utils';
const ResourceField = ({ query, datasource, onQueryChange, selectableEntryTypes, queryType, resources, inlineField, labelWidth, disableRow, renderAdvanced, selectionNotice, }) => {
    const styles = useStyles2(getStyles);
    const [pickerIsOpen, setPickerIsOpen] = useState(false);
    const handleOpenPicker = useCallback(() => {
        setPickerIsOpen(true);
    }, []);
    const closePicker = useCallback(() => {
        setPickerIsOpen(false);
    }, []);
    const handleApply = useCallback((resources) => {
        onQueryChange(setResources(query, queryType, resources));
        closePicker();
    }, [closePicker, onQueryChange, query, queryType]);
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.resourcePicker.select.button },
        React.createElement(Modal, { className: styles.modal, title: "Select a resource", isOpen: pickerIsOpen, onDismiss: closePicker, 
            // The growing number of rows added to the modal causes a focus
            // error in the modal, making it impossible to click on new elements
            trapFocus: false },
            React.createElement(ResourcePicker, { resourcePickerData: datasource.resourcePickerData, resources: resources, onApply: handleApply, onCancel: closePicker, selectableEntryTypes: selectableEntryTypes, queryType: queryType, disableRow: disableRow, renderAdvanced: renderAdvanced, selectionNotice: selectionNotice })),
        React.createElement(Field, { label: "Resource", inlineField: inlineField, labelWidth: labelWidth },
            React.createElement(Button, { className: styles.resourceFieldButton, variant: "secondary", onClick: handleOpenPicker, type: "button" },
                React.createElement(ResourceLabel, { resources: resources, datasource: datasource })))));
};
const ResourceLabel = ({ resources, datasource }) => {
    const [resourcesComponents, setResourcesComponents] = useState(parseMultipleResourceDetails(resources));
    useEffect(() => {
        setResourcesComponents(parseMultipleResourceDetails(resources));
    }, [resources]);
    if (!resources.length) {
        return React.createElement(React.Fragment, null, "Select a resource");
    }
    return React.createElement(FormattedResource, { resources: resourcesComponents });
};
const FormattedResource = ({ resources }) => {
    const styles = useStyles2(getStyles);
    let icon = 'cube';
    const items = [];
    resources.forEach((resource) => {
        if (resource.resourceName) {
            items.push(resource.resourceName.split('/')[0]);
            return;
        }
        if (resource.resourceGroup) {
            icon = 'folder';
            items.push(resource.resourceGroup);
            return;
        }
        if (resource.subscription) {
            icon = 'layer-group';
            items.push(resource.subscription);
            return;
        }
    });
    return (React.createElement("span", { className: cx(styles.truncated, styles.resourceField) },
        React.createElement(Icon, { name: icon }),
        items.join(', ')));
};
export default ResourceField;
//# sourceMappingURL=ResourceField.js.map