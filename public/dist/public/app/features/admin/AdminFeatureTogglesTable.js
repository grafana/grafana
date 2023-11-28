import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { Switch, InteractiveTable, Button } from '@grafana/ui';
import { useUpdateFeatureTogglesMutation } from './AdminFeatureTogglesAPI';
const sortByName = (a, b) => {
    return a.original.name.localeCompare(b.original.name);
};
const sortByDescription = (a, b) => {
    if (!a.original.description && !b.original.description) {
        return 0;
    }
    else if (!a.original.description) {
        return 1;
    }
    else if (!b.original.description) {
        return -1;
    }
    return a.original.description.localeCompare(b.original.description);
};
const sortByEnabled = (a, b) => {
    return a.original.enabled === b.original.enabled ? 0 : a.original.enabled ? 1 : -1;
};
export function AdminFeatureTogglesTable({ featureToggles, onUpdateSuccess }) {
    const [localToggles, setLocalToggles] = useState(featureToggles);
    const [updateFeatureToggles] = useUpdateFeatureTogglesMutation();
    const [modifiedToggles, setModifiedToggles] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const handleToggleChange = (toggle, newValue) => {
        const updatedToggle = Object.assign(Object.assign({}, toggle), { enabled: newValue });
        // Update the local state
        const updatedToggles = localToggles.map((t) => (t.name === toggle.name ? updatedToggle : t));
        setLocalToggles(updatedToggles);
        // Check if the toggle exists in modifiedToggles
        const existingToggle = modifiedToggles.find((t) => t.name === toggle.name);
        // If it exists and its state is the same as the updated one, remove it from modifiedToggles
        if (existingToggle && existingToggle.enabled === newValue) {
            setModifiedToggles((prev) => prev.filter((t) => t.name !== toggle.name));
        }
        else {
            // Else, add/update the toggle in modifiedToggles
            setModifiedToggles((prev) => {
                const newToggles = prev.filter((t) => t.name !== toggle.name);
                newToggles.push(updatedToggle);
                return newToggles;
            });
        }
    };
    const handleSaveChanges = () => __awaiter(this, void 0, void 0, function* () {
        setIsSaving(true);
        try {
            const resp = yield updateFeatureToggles(modifiedToggles);
            // Reset modifiedToggles after successful update
            if (!('error' in resp)) {
                onUpdateSuccess();
                setModifiedToggles([]);
            }
        }
        finally {
            setIsSaving(false);
        }
    });
    const hasModifications = () => {
        // Check if there are any differences between the original toggles and the local toggles
        return featureToggles.some((originalToggle) => {
            const modifiedToggle = localToggles.find((t) => t.name === originalToggle.name);
            return modifiedToggle && modifiedToggle.enabled !== originalToggle.enabled;
        });
    };
    const columns = [
        {
            id: 'name',
            header: 'Name',
            cell: ({ cell: { value } }) => React.createElement("div", null, value),
            sortType: sortByName,
        },
        {
            id: 'description',
            header: 'Description',
            cell: ({ cell: { value } }) => React.createElement("div", null, value),
            sortType: sortByDescription,
        },
        {
            id: 'enabled',
            header: 'State',
            cell: ({ row }) => (React.createElement("div", null,
                React.createElement(Switch, { value: row.original.enabled, disabled: row.original.readOnly, onChange: (e) => handleToggleChange(row.original, e.currentTarget.checked) }))),
            sortType: sortByEnabled,
        },
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', padding: '0 0 5px 0' } },
            React.createElement(Button, { disabled: !hasModifications() || isSaving, onClick: handleSaveChanges }, isSaving ? 'Saving...' : 'Save Changes')),
        React.createElement(InteractiveTable, { columns: columns, data: localToggles, getRowId: (featureToggle) => featureToggle.name })));
}
//# sourceMappingURL=AdminFeatureTogglesTable.js.map