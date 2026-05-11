import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, ConfirmModal, Space, Text } from '@grafana/ui';
import { useGetAffectedItems, useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';

import { useSelectedItemTitles } from '../../state/hooks';
import { type DashboardTreeSelection } from '../../types';
import { DeletedDashboardsInfo } from '../DeletedDashboardsInfo';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

const MAX_ITEMS_TO_LIST = 5;

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const { data } = useGetAffectedItems(selectedItems);
  const deleteIsInvalid = Boolean(data && (data.alertrules || data.library_elements));
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFolders = Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
  const selectedDashboards = Object.keys(selectedItems.dashboard || {}).filter((uid) => selectedItems.dashboard[uid]);
  const selectedPanels = Object.keys(selectedItems.panel || {}).filter((uid) => selectedItems.panel[uid]);
  const { data: folderData } = useGetFolderQueryFacade(selectedFolders.length === 1 ? selectedFolders[0] : undefined);

  const totalDirectlySelected = selectedFolders.length + selectedDashboards.length + selectedPanels.length;
  const selectedItemTitles = useSelectedItemTitles(selectedItems);

  const onlyOneFolderSelected =
    selectedFolders.length === 1 && selectedDashboards.length === 0 && selectedPanels.length === 0;

  const showItemNames = totalDirectlySelected <= MAX_ITEMS_TO_LIST && selectedItemTitles.length > 0;

  const onDelete = async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: Object.keys(selectedItems.dashboard).length,
        folder: Object.keys(selectedItems.folder).length,
      },
      source: 'browse_dashboards',
    });
    setIsDeleting(true);
    try {
      await onConfirm();
      setIsDeleting(false);
      onDismiss();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <DeletedDashboardsInfo target="folder" />
          <Space v={2} />
          <Text element="p">
            {onlyOneFolderSelected ? (
              <Trans
                i18nKey="browse-dashboards.action.delete-modal-text-one-folder"
                values={{ folderName: folderData?.title }}
              >
                This action will delete the folder &quot;
                <Text variant="code" weight="bold">
                  {'{{ folderName }}'}
                </Text>
                &quot; and the following content:
              </Trans>
            ) : showItemNames ? (
              <Trans i18nKey="browse-dashboards.action.delete-modal-text-named-items">
                This action will delete the following:
              </Trans>
            ) : (
              <Trans i18nKey="browse-dashboards.action.delete-modal-text">
                This action will delete the following content:
              </Trans>
            )}
          </Text>
          {showItemNames && !onlyOneFolderSelected ? (
            <ul>
              {selectedItemTitles.map(({ kind, title }) => (
                <li key={title}>
                  <Text weight="bold">{title}</Text>
                  {selectedFolders.length > 0 && kind === 'folder' && (
                    <Text color="secondary">
                      {' '}
                      ({t('browse-dashboards.action.delete-modal-item-kind-folder', 'folder')})
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {(onlyOneFolderSelected || !showItemNames) && <DescendantCount selectedItems={selectedItems} />}
          {showItemNames && !onlyOneFolderSelected && selectedFolders.length > 0 && (
            <>
              <Space v={1} />
              <DescendantCount selectedItems={selectedItems} />
            </>
          )}
          <Space v={2} />
        </>
      }
      description={
        <>
          {deleteIsInvalid ? (
            <Alert
              severity="warning"
              title={t('browse-dashboards.action.delete-modal-invalid-title', 'Cannot delete folder')}
            >
              <Trans i18nKey="browse-dashboards.action.delete-modal-invalid-text">
                One or more folders contain library panels or alert rules. Delete these first in order to proceed.
              </Trans>
            </Alert>
          ) : null}
        </>
      }
      confirmationText={t('browse-dashboards.action.confirmation-text', 'Delete')}
      confirmText={
        isDeleting
          ? t('browse-dashboards.action.deleting', 'Deleting...')
          : t('browse-dashboards.action.delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={t('browse-dashboards.action.delete-modal-title', 'Delete')}
      {...props}
      disabled={deleteIsInvalid}
    />
  );
};
