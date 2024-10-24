import { Modal, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useNewFolderMutation } from '../../../features/browse-dashboards/api/browseDashboardsAPI';
import { NewFolderForm } from '../../../features/browse-dashboards/components/NewFolderForm';

export const FolderCreationModal = ({ onDismissModal, ...props }) => {
  const [newFolder] = useNewFolderMutation();
  const onCreateNewFolder = async (folderName: string) => {
    try {
      await newFolder({
        title: folderName,
      });
    } finally {
    }
    // todo: catch error or close modal in finally?
  };

  return (
    <Modal
      isOpen={true}
      title={t('browse-dashboards.folder-picker.folder-creation-modal.title', 'New Folder')}
      {...props}
    >
      <Text>
        <Trans i18nKey="browse-dashboards.folder-picker.folder-creation-modal.text">
          Create a new folder to store your restored dashboard
        </Trans>
      </Text>
      <NewFolderForm onConfirm={onCreateNewFolder} onCancel={onDismissModal} />
    </Modal>
  );
};
