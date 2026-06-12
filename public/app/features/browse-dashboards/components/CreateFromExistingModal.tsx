import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import { DashboardPicker, type DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

interface Props {
  // Folder the new dashboard should be created in, if any.
  folderUid?: string;
  onDismiss: () => void;
}

/**
 * Lets the user search for an existing dashboard and, on selection, navigates to
 * the "create from existing" flow which opens an unsaved draft pre-populated with
 * the chosen dashboard's layout.
 */
export function CreateFromExistingModal({ folderUid, onDismiss }: Props) {
  const onChange = (value?: DashboardPickerDTO) => {
    if (!value?.uid) {
      return;
    }

    const params = new URLSearchParams({ sourceUid: value.uid });
    if (folderUid) {
      params.set('folderUid', folderUid);
    }

    reportInteraction('grafana_dashboard_create_from_existing_selected', { folderUid: folderUid ?? '' });
    onDismiss();
    locationService.push(`/dashboard/new-from-existing?${params.toString()}`);
  };

  return (
    <Modal
      isOpen
      title={t('browse-dashboards.create-from-existing.title', 'Create dashboard from existing')}
      onDismiss={onDismiss}
    >
      <DashboardPicker
        onChange={onChange}
        autoFocus
        openMenuOnFocus
        placeholder={t('browse-dashboards.create-from-existing.placeholder', 'Search for a dashboard')}
      />
    </Modal>
  );
}
