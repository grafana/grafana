import { useCallback, useEffect, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { config, FetchError, isFetchError } from '@grafana/runtime';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';
import { Button, Field, Input, Modal, Stack } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { PanelModel } from '../../../dashboard/state/PanelModel';
import { getLibraryPanelByName } from '../../state/api';
import { usePanelSave } from '../../utils/usePanelSave';

interface AddLibraryPanelContentsProps {
  onDismiss?: () => void;
  panel: PanelModel;
  initialFolderUid?: string;
  onCreateLibraryPanel?: (libPanel: LibraryPanel) => void;
}

export const AddLibraryPanelContents = ({
  panel,
  initialFolderUid,
  onCreateLibraryPanel,
  onDismiss,
}: AddLibraryPanelContentsProps) => {
  const [folderUid, setFolderUid] = useState(initialFolderUid);
  const [panelName, setPanelName] = useState(panel.title);
  const [debouncedPanelName, setDebouncedPanelName] = useState(panel.title);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => setWaiting(true), [panelName]);
  useDebounce(() => setDebouncedPanelName(panelName), 350, [panelName]);

  const { saveLibraryPanel } = usePanelSave();

  const onCreate = useCallback(() => {
    panel.libraryPanel = { uid: '', name: panelName };

    saveLibraryPanel(panel, folderUid!).then((res: LibraryPanel | FetchError) => {
      if (!isFetchError(res)) {
        onDismiss?.();
        onCreateLibraryPanel?.(res);
      } else {
        panel.libraryPanel = undefined;
      }
    });
  }, [panel, panelName, saveLibraryPanel, folderUid, onDismiss, onCreateLibraryPanel]);

  const isValidName = useAsync(async () => {
    try {
      return !(await getLibraryPanelByName(panelName)).some((lp) => lp.folderUid === folderUid);
    } catch (err) {
      if (isFetchError(err)) {
        err.isHandled = true;
      }
      return true;
    } finally {
      setWaiting(false);
    }
  }, [debouncedPanelName, folderUid]);

  const invalidInput =
    !isValidName?.value && isValidName.value !== undefined && panelName === debouncedPanelName && !waiting;

  return (
    <>
      <Field
        label={t('library-panel.add-modal.name', 'Library panel name')}
        invalid={invalidInput}
        error={invalidInput ? t('library-panel.add-modal.error', 'Library panel with this name already exists') : ''}
      >
        <Input
          id="share-panel-library-panel-name-input"
          name="name"
          value={panelName}
          onChange={(e) => setPanelName(e.currentTarget.value)}
        />
      </Field>
      <Field
        label={t('library-panel.add-modal.folder', 'Save in folder')}
        description={t(
          'library-panel.add-modal.folder-description',
          'Library panel permissions are derived from the folder permissions'
        )}
      >
        <FolderPicker onChange={(uid) => setFolderUid(uid)} value={folderUid} />
      </Field>
      {config.featureToggles.newDashboardSharingComponent ? (
        <Stack gap={1} justifyContent={'start'}>
          <Button onClick={onCreate} disabled={invalidInput}>
            <Trans i18nKey="share-panel.new-library-panel.create-button">Create library panel</Trans>
          </Button>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="share-panel.new-library-panel.cancel-button">Cancel</Trans>
          </Button>
        </Stack>
      ) : (
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="library-panel.add-modal.cancel">Cancel</Trans>
          </Button>
          <Button onClick={onCreate} disabled={invalidInput}>
            <Trans i18nKey="library-panel.add-modal.create">Create library panel</Trans>
          </Button>
        </Modal.ButtonRow>
      )}
    </>
  );
};

interface Props extends AddLibraryPanelContentsProps {
  isOpen?: boolean;
}

export const AddLibraryPanelModal = ({ isOpen = false, panel, initialFolderUid, ...props }: Props) => {
  return (
    <Modal
      title={t('library-panels.add-library-panel-modal.title-create-library-panel', 'Create library panel')}
      isOpen={isOpen}
      onDismiss={props.onDismiss}
    >
      <AddLibraryPanelContents panel={panel} initialFolderUid={initialFolderUid} onDismiss={props.onDismiss} />
    </Modal>
  );
};
