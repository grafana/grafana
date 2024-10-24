import { Modal, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useNewFolderMutation } from '../../../features/browse-dashboards/api/browseDashboardsAPI';
import { NewFolderForm } from '../../../features/browse-dashboards/components/NewFolderForm';

export interface FolderCreationModalProps {
  isOpen: boolean;
  onConfirm: () => void; //TODO: is this true?
  onDismissModal: () => void;
}

export const FolderCreationModal = ({ onDismissModal, ...props }: FolderCreationModalProps) => {
  const [newFolder] = useNewFolderMutation();
  const onCreateNewFolder = async (folderName: string) => {
    try {
      await newFolder({
        title: folderName,
      });
    } finally {
    }
    // TODO: catch error or close modal in finally?
  };

  //TODO: adjust styling of input in NewFolderForm
  return (
    <Modal title={t('browse-dashboards.folder-picker.folder-creation-modal.title', 'New Folder')} {...props}>
      <Text>
        <Trans i18nKey="browse-dashboards.folder-picker.folder-creation-modal.text">
          Create a new folder to store your restored dashboard
        </Trans>
      </Text>
      <NewFolderForm onConfirm={onCreateNewFolder} onCancel={onDismissModal} />
    </Modal>
  );
};
