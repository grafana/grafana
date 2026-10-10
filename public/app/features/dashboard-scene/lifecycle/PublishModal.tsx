import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Field, Input, Modal, Stack, Text } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { publishDraft } from './lifecycleApi';

interface Props {
  uid: string;
  title: string;
  folderUid?: string;
  onDismiss: () => void;
  onPublished: () => void;
}

/** Publishing moves a draft into a folder, where everyone with access to the folder can see it. */
export function PublishModal({ uid, title: initialTitle, folderUid, onDismiss, onPublished }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [folder, setFolder] = useState<string | undefined>(folderUid);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onPublish = async () => {
    if (!title.trim()) {
      setError(t('dashboard-scene.lifecycle.publish-title-required', 'Enter a title'));
      return;
    }
    setPublishing(true);
    try {
      await publishDraft(uid, { title: title.trim(), folder: folder ?? '' });
      onPublished();
    } catch {
      setError(
        t(
          'dashboard-scene.lifecycle.publish-failed',
          "Couldn't publish. You may not have permission to create dashboards in that folder."
        )
      );
      setPublishing(false);
    }
  };

  return (
    <Modal title={t('dashboard-scene.lifecycle.publish-title', 'Publish dashboard')} isOpen onDismiss={onDismiss}>
      <Stack direction="column" gap={2}>
        <Text color="secondary">
          <Trans i18nKey="dashboard-scene.lifecycle.publish-description">
            Publishing moves this draft into a folder. Everyone with access to that folder can see it.
          </Trans>
        </Text>
        <Field
          noMargin
          label={t('dashboard-scene.lifecycle.publish-field-title', 'Title')}
          invalid={!!error}
          error={error}
        >
          <Input
            id="lifecycle-publish-title"
            value={title}
            onChange={(e) => {
              setTitle(e.currentTarget.value);
              setError(undefined);
            }}
          />
        </Field>
        <Field noMargin label={t('dashboard-scene.lifecycle.publish-field-folder', 'Folder')}>
          <FolderPicker value={folder} onChange={(uid) => setFolder(uid)} />
        </Field>
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard-scene.lifecycle.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={onPublish} disabled={publishing}>
          {publishing
            ? t('dashboard-scene.lifecycle.publishing', 'Publishing…')
            : t('dashboard-scene.lifecycle.publish', 'Publish')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
