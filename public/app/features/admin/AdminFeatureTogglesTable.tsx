import { useState, useRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Switch, InteractiveTable, Tooltip, type CellProps, Button, ConfirmModal, type SortByFn } from '@grafana/ui';

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
  const [showSaveModel, setShowSaveModal] = useState(false);

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

  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const showSaveChangesModal = (show: boolean) => () => {
    setShowSaveModal(show);
    if (!show && saveButtonRef.current) {
      saveButtonRef.current.focus();
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
      return 'This is a non-editable feature';
    }
    return '';
  };

  const getStageCell = (stage: string) => {
    switch (stage) {
      case 'GA':
        return (
          <Tooltip
            content={t(
              'admin.admin-feature-toggles-table.get-stage-cell.content-general-availability',
              'General availability'
            )}
          >
            <div>
              <Trans i18nKey="admin.admin-feature-toggles-table.get-stage-cell.ga">GA</Trans>
            </div>
          </Tooltip>
        );
      case 'privatePreview':
      case 'preview':
      case 'experimental':
        return t('admin.admin-feature-toggles-table.get-stage-cell.beta', 'Beta');
      case 'deprecated':
        return t('admin.admin-feature-toggles-table.get-stage-cell.deprecated', 'Deprecated');
      default:
        return stage;
    }
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
      id: 'stage',
      header: 'Stage',
      cell: ({ cell: { value } }: CellProps<FeatureToggle, string>) => <div>{getStageCell(value)}</div>,
    },
    {
      id: 'enabled',
      header: 'State',
      cell: ({ row }: CellProps<FeatureToggle, boolean>) => {
        const renderStateSwitch = (
          <div>
            <Switch
              value={row.original.enabled}
              disabled={row.original.readOnly}
              onChange={(e) => handleToggleChange(row.original, e.currentTarget.checked)}
            />
          </div>
        );

        return row.original.readOnly ? (
          <Tooltip content={getToggleTooltipContent(row.original.readOnly)}>{renderStateSwitch}</Tooltip>
        ) : (
          renderStateSwitch
        );
      },
      sortType: sortByEnabled,
    },
  ];

  return (
    <>
      {allowEditing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 5px 0' }}>
          <Button disabled={!hasModifications() || isSaving} onClick={showSaveChangesModal(true)} ref={saveButtonRef}>
            {isSaving
              ? t('admin.admin-feature-toggles-table.saving', 'Saving...')
              : t('admin.admin-feature-toggles-table.save-changes', 'Save changes')}
          </Button>
          <ConfirmModal
            isOpen={showSaveModel}
            title={t(
              'admin.admin-feature-toggles-table.title-apply-feature-toggle-changes',
              'Apply feature toggle changes'
            )}
            body={
              <div>
                <p>
                  <Trans i18nKey="admin.admin-feature-toggles-table.confirm-modal-body-1">
                    Some features are stable (GA) and enabled by default, whereas some are currently in their
                    preliminary Beta phase, available for early adoption.
                  </Trans>
                </p>
                <p>
                  <Trans i18nKey="admin.admin-feature-toggles-table.confirm-modal-body-2">
                    We advise understanding the implications of each feature change before making modifications.
                  </Trans>
                </p>
              </div>
            }
            confirmText={t('admin.admin-feature-toggles-table.confirmText-save-changes', 'Save changes')}
            onConfirm={async () => {
              showSaveChangesModal(false)();
              handleSaveChanges();
            }}
            onDismiss={showSaveChangesModal(false)}
          />
        </div>
      )}
      <InteractiveTable columns={columns} data={localToggles} getRowId={(featureToggle) => featureToggle.name} />
    </>
  );
}
