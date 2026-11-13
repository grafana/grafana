import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Alert, Box, Button, Stack } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { saveLibPanel } from 'app/features/library-panels/state/api';
import { dispatch } from 'app/store/store';

import { discardLibraryPanelOptionChanges } from '../../actions/panel/changePanelOptions';
import { SaveLibraryVizPanelModal } from '../../panel-edit/SaveLibraryVizPanelModal';
import { type LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';

interface Props {
  panel: VizPanel;
  libraryPanel: LibraryPanelBehavior;
}

export function LibraryPanelSidebarNotice({ panel, libraryPanel }: Props) {
  // Re-render on option changes, which decide whether there is anything to save
  panel.useState();
  const { name } = libraryPanel.useState();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const hasUnsavedChanges = libraryPanel.hasUnsavedOptionChanges();

  const onConfirmSave = async () => {
    setIsSaveModalOpen(false);
    try {
      await saveLibPanel(panel);
    } catch (error) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('dashboard.sidebar.library-panel.save-error', 'Failed to save library panel'),
            error instanceof Error ? error.message : undefined
          )
        )
      );
    }
  };

  return (
    <Box paddingX={2} paddingTop={2} key="library-panel-notice">
      <Alert
        severity="info"
        title={t('dashboard.sidebar.library-panel.title', 'Library panel: {{name}}', { name })}
        bottomSpacing={0}
      >
        <Stack direction="column" gap={1.5}>
          <div>
            {hasUnsavedChanges ? (
              <Trans i18nKey="dashboard.sidebar.library-panel.unsaved-changes">
                You have unsaved changes. Save the library panel to update every dashboard that uses it.
              </Trans>
            ) : (
              <Trans i18nKey="dashboard.sidebar.library-panel.description">
                Changes to these options apply to every dashboard that uses this library panel once you save it.
              </Trans>
            )}
          </div>
          <Stack gap={1}>
            <Button size="sm" disabled={!hasUnsavedChanges} onClick={() => setIsSaveModalOpen(true)}>
              <Trans i18nKey="dashboard.sidebar.library-panel.save">Save library panel</Trans>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              fill="outline"
              disabled={!hasUnsavedChanges}
              onClick={() => discardLibraryPanelOptionChanges(panel)}
            >
              <Trans i18nKey="dashboard.sidebar.library-panel.discard">Discard</Trans>
            </Button>
          </Stack>
        </Stack>
      </Alert>
      {isSaveModalOpen && (
        <SaveLibraryVizPanelModal
          libraryPanel={libraryPanel}
          onConfirm={onConfirmSave}
          onDismiss={() => setIsSaveModalOpen(false)}
          onDiscard={() => setIsSaveModalOpen(false)}
        />
      )}
    </Box>
  );
}
