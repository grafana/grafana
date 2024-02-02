import React, { useState, useRef } from 'react';

import { Switch, InteractiveTable, Tooltip, type CellProps, Button, type SortByFn } from '@grafana/ui';

import { FeatureToggle, getTogglesAPI } from './AdminFeatureTogglesAPI';

interface Props {
  featureToggles: FeatureToggle[];
  allowEditing: boolean;
  onUpdateSuccess: () => void;
}

const sortByName: SortByFn<FeatureToggle> = (a, b) => {
  return a.original.name.localeCompare(b.original.name);
};

const sortByDescription: SortByFn<FeatureToggle> = (a, b) => {
  if (!a.original.description && !b.original.description) {
    return 0;
  } else if (!a.original.description) {
    return 1;
  } else if (!b.original.description) {
    return -1;
  }
  return a.original.description.localeCompare(b.original.description);
};

const sortByEnabled: SortByFn<FeatureToggle> = (a, b) => {
  return a.original.enabled === b.original.enabled ? 0 : a.original.enabled ? 1 : -1;
};

export function AdminFeatureTogglesTable({ featureToggles, allowEditing, onUpdateSuccess }: Props) {
  // sort manually, doesn't look like it can be automatically done in the table
  featureToggles.sort((a, b) => a.name.localeCompare(b.name));
  const serverToggles = useRef<FeatureToggle[]>(featureToggles);
  const [localToggles, setLocalToggles] = useState<FeatureToggle[]>(featureToggles);
  const [isSaving, setIsSaving] = useState(false);
  const togglesApi = getTogglesAPI();

  const handleToggleChange = (toggle: FeatureToggle, newValue: boolean) => {
    const updatedToggle = { ...toggle, enabled: newValue };

    // Update the local state
    const updatedToggles = localToggles.map((t) => (t.name === toggle.name ? updatedToggle : t));
    setLocalToggles(updatedToggles);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const modifiedToggles = getModifiedToggles();
      await togglesApi.updateFeatureToggles(modifiedToggles);
      // Pretend the values came from a new request
      serverToggles.current = [...localToggles];
      onUpdateSuccess(); // should trigger a new get
    } finally {
      setIsSaving(false);
    }
  };

  const getModifiedToggles = (): FeatureToggle[] => {
    return localToggles.filter((toggle, index) => toggle.enabled !== serverToggles.current[index].enabled);
  };

  const hasModifications = () => {
    // Check if there are any differences between the original toggles and the local toggles
    return localToggles.some((toggle, index) => toggle.enabled !== serverToggles.current[index].enabled);
  };

  const getToggleTooltipContent = (readOnlyToggle?: boolean) => {
    if (!allowEditing) {
      return 'Feature management is not configured for editing';
    }
    if (readOnlyToggle) {
      return 'Preview features are not editable';
    }
    return '';
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
        <Tooltip content={getToggleTooltipContent(row.original.readOnly)}>
          <div>
            <Switch
              value={row.original.enabled}
              disabled={row.original.readOnly}
              onChange={(e) => handleToggleChange(row.original, e.currentTarget.checked)}
            />
          </div>
        </Tooltip>
      ),
      sortType: sortByEnabled,
    },
  ];

  return (
    <>
      {allowEditing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 5px 0' }}>
          <Button disabled={!hasModifications() || isSaving} onClick={handleSaveChanges}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
      <InteractiveTable columns={columns} data={localToggles} getRowId={(featureToggle) => featureToggle.name} />
    </>
  );
}
