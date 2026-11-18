import { customAlphabet } from 'nanoid';
import { useCallback, useEffect, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type FetchError, isFetchError } from '@grafana/runtime';
import { type LibraryPanel } from '@grafana/schema';
import { Button, Field, Input, Stack } from '@grafana/ui';
import { isK8sLibraryPanelsClientEnabled } from 'app/api/clients/dashboard/v0alpha1/libraryPanels';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { RepositorySelect } from 'app/features/provisioning/components/Shared/RepositorySelect';
import { useResourceRepositorySelection } from 'app/features/provisioning/hooks/useResourceRepositorySelection';
import { resourceKindInfos } from 'app/features/provisioning/utils/resourceKinds';

import { type PanelModel } from '../../../dashboard/state/PanelModel';
import { getLibraryPanelByName } from '../../state/api';
import { usePanelSave } from '../../utils/usePanelSave';
import { SaveProvisionedLibraryPanelDrawer } from '../SaveProvisionedLibraryPanelDrawer';

// A repository create commits the panel under a name chosen here, so the dashboard panel can be linked to it.
const generateUid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

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
  const { isAvailable, repositories } = useResourceRepositorySelection(resourceKindInfos.librarypanel);
  // Repository ownership is only visible through the app-platform client, which keeps the annotations.
  const { value: k8sClientEnabled } = useAsync(isK8sLibraryPanelsClientEnabled, []);
  // No selection = save to Grafana; a repository name routes the save through the provisioning drawer.
  const [repositoryName, setRepositoryName] = useState('');
  const [provisionedPanel, setProvisionedPanel] = useState<Pick<LibraryPanel, 'uid' | 'name' | 'model'>>();

  useEffect(() => setWaiting(true), [panelName]);
  useDebounce(() => setDebouncedPanelName(panelName), 350, [panelName]);

  const { saveLibraryPanel } = usePanelSave();

  const onCreate = useCallback(() => {
    if (repositoryName) {
      const { scopedVars, ...model } = panel.getSaveModel();
      setProvisionedPanel({ uid: generateUid(), name: panelName, model });
      return;
    }
    panel.libraryPanel = { uid: '', name: panelName };

    saveLibraryPanel(panel, folderUid!).then((res: LibraryPanel | FetchError) => {
      if (!isFetchError(res)) {
        onDismiss?.();
        onCreateLibraryPanel?.(res);
      } else {
        panel.libraryPanel = undefined;
      }
    });
  }, [panel, panelName, repositoryName, saveLibraryPanel, folderUid, onDismiss, onCreateLibraryPanel]);

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

  // A repository create places the panel by its file path, not by the folder checked here.
  const invalidInput =
    !repositoryName &&
    !isValidName?.value &&
    isValidName.value !== undefined &&
    panelName === debouncedPanelName &&
    !waiting;

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('library-panel.add-modal.name', 'Library panel name')}
        invalid={invalidInput}
        error={invalidInput ? t('library-panel.add-modal.error', 'Library panel with this name already exists') : ''}
      >
        <Input
          id="share-panel-library-panel-name-input"
          data-testid={selectors.components.Drawer.NewLibraryPanelDrawer.nameInput}
          name="name"
          value={panelName}
          onChange={(e) => setPanelName(e.currentTarget.value)}
        />
      </Field>
      {isAvailable && k8sClientEnabled && (
        <RepositorySelect repositories={repositories} value={repositoryName} onChange={setRepositoryName} />
      )}
      {!repositoryName && (
        <Field
          noMargin
          label={t('library-panel.add-modal.folder', 'Save in folder')}
          description={t(
            'library-panel.add-modal.folder-description',
            'Library panel permissions are derived from the folder permissions'
          )}
        >
          <FolderPicker onChange={(uid) => setFolderUid(uid)} value={folderUid} />
        </Field>
      )}
      <Stack gap={1} justifyContent={'start'}>
        <Button
          onClick={onCreate}
          disabled={invalidInput}
          data-testid={selectors.components.Drawer.NewLibraryPanelDrawer.createButton}
        >
          <Trans i18nKey="share-panel.new-library-panel.create-button">Create library panel</Trans>
        </Button>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="share-panel.new-library-panel.cancel-button">Cancel</Trans>
        </Button>
      </Stack>
      {provisionedPanel && (
        <SaveProvisionedLibraryPanelDrawer
          action="create"
          repositoryName={repositoryName}
          panel={provisionedPanel}
          onDismiss={() => setProvisionedPanel(undefined)}
          onWriteSuccess={() => {
            onDismiss?.();
            // Linking only needs the identity: the library panel behavior loads the committed panel itself.
            onCreateLibraryPanel?.({ ...provisionedPanel, type: provisionedPanel.model.type, version: 0 });
          }}
        />
      )}
    </Stack>
  );
};
