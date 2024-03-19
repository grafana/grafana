import React, { useCallback, useEffect, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { PanelModel } from '@grafana/data';
import { FetchError, isFetchError } from '@grafana/runtime';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';
import { Button, Field, Input, Modal } from '@grafana/ui';
import { OldFolderPicker } from 'app/core/components/Select/OldFolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { PanelModel as LegacyPanelModel } from 'app/features/dashboard/state';

import { getLibraryPanelByName } from '../../state/api';
import { LibraryElementDTO } from '../../types';
import { usePanelSave, usePanelSave2 } from '../../utils/usePanelSave';

interface AddLibraryPanelContentsProps {
  onDismiss?: () => void;
  panel: LegacyPanelModel;
  initialFolderUid?: string;
}

export const AddLibraryPanelContents = ({ panel, initialFolderUid, onDismiss }: AddLibraryPanelContentsProps) => {
  const [folderUid, setFolderUid] = useState(initialFolderUid);
  const [panelName, setPanelName] = useState(panel.title);
  const [debouncedPanelName, setDebouncedPanelName] = useState(panel.title);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => setWaiting(true), [panelName]);
  useDebounce(() => setDebouncedPanelName(panelName), 350, [panelName]);

  const { saveLibraryPanel } = usePanelSave();

  const onCreate = useCallback(() => {
    panel.libraryPanel = { uid: '', name: panelName };
    saveLibraryPanel(panel, folderUid!).then((res: LibraryElementDTO | FetchError) => {
      if (!isFetchError(res)) {
        onDismiss?.();
      } else {
        panel.libraryPanel = undefined;
      }
    });
  }, [panel, panelName, folderUid, onDismiss, saveLibraryPanel]);

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
        <OldFolderPicker
          onChange={({ uid }) => setFolderUid(uid)}
          initialFolderUid={initialFolderUid}
          inputId="share-panel-library-panel-folder-picker"
        />
      </Field>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="library-panel.add-modal.cancel">Cancel</Trans>
        </Button>
        <Button onClick={onCreate} disabled={invalidInput}>
          <Trans i18nKey="library-panel.add-modal.create">Create library panel</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
};

interface Props extends AddLibraryPanelContentsProps {
  isOpen?: boolean;
}

export const AddLibraryPanelModal = ({ isOpen = false, panel, initialFolderUid, ...props }: Props) => {
  return (
    <Modal title="Create library panel" isOpen={isOpen} onDismiss={props.onDismiss}>
      <AddLibraryPanelContents panel={panel} initialFolderUid={initialFolderUid} onDismiss={props.onDismiss} />
    </Modal>
  );
};

// --------- dashboard scene ----------

interface AddLibraryPanelContentsProps2 {
  onDismiss?: () => void;
  panel: PanelModel;
  initialFolderUid?: string;
}

export const AddLibraryPanelContents2 = ({ panel, initialFolderUid, onDismiss }: AddLibraryPanelContentsProps2) => {
  const [folderUid, setFolderUid] = useState(initialFolderUid);
  const [panelName, setPanelName] = useState(panel.title ?? 'Panel title');
  const [debouncedPanelName, setDebouncedPanelName] = useState(panel.title ?? 'Panel title');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => setWaiting(true), [panelName]);
  useDebounce(() => setDebouncedPanelName(panelName), 350, [panelName]);

  const { saveLibraryPanel } = usePanelSave2();

  const onCreate = useCallback(() => {
    const panelModel: PanelModel = {
      id: panel.id,
      type: panel.type,
      title: panel.title,
      description: panel.description,
      transformations: panel.transformations,
      targets: panel.targets,
      datasource: panel.datasource,
      options: panel.options,
      fieldConfig: panel.fieldConfig,
      pluginVersion: panel.pluginVersion,
    };
    panelModel.libraryPanel = { uid: '', name: panelName };
    saveLibraryPanel(panelModel, folderUid!).then((res: LibraryPanel | FetchError) => {
      if (!isFetchError(res)) {
        onDismiss?.();
      }
    });
  }, [panel, panelName, folderUid, onDismiss, saveLibraryPanel]);

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
        <OldFolderPicker
          onChange={({ uid }) => setFolderUid(uid)}
          initialFolderUid={initialFolderUid}
          inputId="share-panel-library-panel-folder-picker"
        />
      </Field>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="library-panel.add-modal.cancel">Cancel</Trans>
        </Button>
        <Button onClick={onCreate} disabled={invalidInput}>
          <Trans i18nKey="library-panel.add-modal.create">Create library panel</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
};

interface Props2 extends AddLibraryPanelContentsProps2 {
  isOpen?: boolean;
}

export const AddLibraryPanelModal2 = ({ isOpen = false, panel, initialFolderUid, ...props }: Props2) => {
  return (
    <Modal title="Create library panel" isOpen={isOpen} onDismiss={props.onDismiss}>
      <AddLibraryPanelContents2 panel={panel} initialFolderUid={initialFolderUid} onDismiss={props.onDismiss} />
    </Modal>
  );
};
