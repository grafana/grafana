import React, { useState } from 'react';

import { Switch, InteractiveTable, type CellProps, Button, type SortByFn } from '@grafana/ui';

import { type FeatureToggle, useUpdateFeatureTogglesMutation } from './AdminFeatureTogglesAPI';

interface Props {
  featureToggles: FeatureToggle[];
}

const sortByName: SortByFn<FeatureToggle> = (a, b) => {
  return a.original.name.localeCompare(b.original.name);
};

const sortByDescription: SortByFn<FeatureToggle> = (a, b) => {
  return a.original.description.localeCompare(b.original.description);
};

const sortByEnabled: SortByFn<FeatureToggle> = (a, b) => {
  return a.original.enabled === b.original.enabled ? 0 : a.original.enabled ? 1 : -1;
};

export function AdminFeatureTogglesTable({ featureToggles }: Props) {
  const [localToggles, setLocalToggles] = useState<FeatureToggle[]>(featureToggles);
  const [updateFeatureToggles] = useUpdateFeatureTogglesMutation();
  const [modifiedToggles, setModifiedToggles] = useState<FeatureToggle[]>([]);

  const handleToggleChange = (toggle: FeatureToggle, newValue: boolean) => {
    const updatedToggle = { ...toggle, enabled: newValue };

    // Update the local state
    const updatedToggles = localToggles.map((t) => (t.name === toggle.name ? updatedToggle : t));
    setLocalToggles(updatedToggles);

    // Check if the toggle exists in modifiedToggles
    const existingToggle = modifiedToggles.find((t) => t.name === toggle.name);

    // If it exists and its state is the same as the updated one, remove it from modifiedToggles
    if (existingToggle && existingToggle.enabled === newValue) {
      setModifiedToggles((prev) => prev.filter((t) => t.name !== toggle.name));
    } else {
      // Else, add/update the toggle in modifiedToggles
      setModifiedToggles((prev) => {
        const newToggles = prev.filter((t) => t.name !== toggle.name);
        newToggles.push(updatedToggle);
        return newToggles;
      });
    }
  };

  const handleSaveChanges = async () => {
    const { error: errResponse } = await updateFeatureToggles(modifiedToggles);
    // Reset modifiedToggles after successful update
    if (!errResponse) {
      setModifiedToggles([]);
    }
  };

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
      cell: ({ cell: { value } }: CellProps<FeatureToggle, string>) => <div>{value}</div>,
      sortType: sortByName,
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ cell: { value } }: CellProps<FeatureToggle, string>) => <div>{value}</div>,
      sortType: sortByDescription,
    },
    {
      id: 'enabled',
      header: 'State',
      cell: ({ row }: CellProps<FeatureToggle, boolean>) => (
        <div>
          <Switch
            value={row.original.enabled}
            disabled={row.original.readOnly}
            onChange={(e) => handleToggleChange(row.original, e.currentTarget.checked)}
          />
        </div>
      ),
      sortType: sortByEnabled,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 5px 0' }}>
        <Button disabled={!hasModifications()} onClick={handleSaveChanges}>Save Changes</Button>
      </div>
      <InteractiveTable columns={columns} data={localToggles} getRowId={(featureToggle) => featureToggle.name} />
    </>
  );
}
