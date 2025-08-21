import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Label, Modal, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { useNewFolderMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { AccessControlAction } from 'app/types/accessControl';

import { Folder } from '../../types/rule-form';

/**
 * Provides a button and associated modal for creating a new folder
 */
export const CreateNewFolder = ({ onCreate }: { onCreate: (folder: Folder) => void }) => {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const handleCreate = (folder: Folder) => {
    onCreate(folder);
    setIsCreatingFolder(false);
  };
  return (
    <>
      <Button
        onClick={() => setIsCreatingFolder(true)}
        type="button"
        icon="plus"
        fill="outline"
        variant="secondary"
        disabled={!contextSrv.hasPermission(AccessControlAction.FoldersCreate)}
      >
        <Trans i18nKey="alerting.create-new-folder.new-folder">New folder</Trans>
      </Button>
      {isCreatingFolder && <FolderCreationModal onCreate={handleCreate} onClose={() => setIsCreatingFolder(false)} />}
    </>
  );
};

function FolderCreationModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (folder: Folder) => void;
}): React.ReactElement {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [title, setTitle] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolder] = useNewFolderMutation();

  const onSubmit = async () => {
    setIsCreatingFolder(true);
    const { data, error } = await createFolder({ title });

    if (error) {
      notifyApp.error('Failed to create folder');
    } else if (data) {
      onCreate({ title: data.title, uid: data.uid });
      notifyApp.success('Folder created');
    }
    setIsCreatingFolder(false);
  };

  return (
    <Modal
      className={styles.modal}
      isOpen
      title={t('alerting.create-new-folder.title-new-folder', 'New folder')}
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <Stack direction="column" gap={2}>
        <Field
          label={
            <Label htmlFor="folder">
              <Trans i18nKey="alerting.create-new-folder.folder.name">Folder name</Trans>
            </Label>
          }
        >
          <Input
            data-testid={selectors.components.AlertRules.newFolderNameField}
            autoFocus={true}
            id="folderName"
            placeholder={t('alerting.create-new-folder.placeholder-enter-a-name', 'Enter a name')}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" type="button" onClick={onClose}>
            <Trans i18nKey="alerting.create-new-folder.folder.cancel">Cancel</Trans>
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!title || isCreatingFolder}
            data-testid={selectors.components.AlertRules.newFolderNameCreateButton}
          >
            <Trans i18nKey="alerting.create-new-folder.folder.create">Create</Trans>
          </Button>
        </Modal.ButtonRow>
      </Stack>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: `${theme.breakpoints.values.sm}px`,
  }),
});
