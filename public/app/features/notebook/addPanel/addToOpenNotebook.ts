import { t } from '@grafana/i18n';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_ADD_TARGET, type NotebookEntryPoint } from '../analytics/types';
import { type PanelElement } from '../types';

import { addPanelErrorMessage, addPanelFailureReason, addToExistingNotebook } from './addPanelToNotebook';
import { shouldLockCapturedTimeRange, withCapturedTimeRange, type CapturedTimeRange } from './capturedTimeRange';

interface Params {
  buildPanel: () => Promise<PanelElement>;
  capturedTimeRange: CapturedTimeRange;
  isLibraryPanel: boolean;
  entryPoint: NotebookEntryPoint;
  open: { uid: string; title: string };
}

/**
 * The one-click path to a notebook that is already open: no picker, no modal. Mirrors the modal's
 * submit so the two cannot drift — the time range is locked by the same rule the modal defaults to.
 */
export async function addPanelToOpenNotebook({
  buildPanel,
  capturedTimeRange,
  isLibraryPanel,
  entryPoint,
  open,
}: Params): Promise<void> {
  const lockTimeRange = shouldLockCapturedTimeRange(capturedTimeRange);
  let panelWasBuilt = false;

  try {
    const built = await buildPanel();
    panelWasBuilt = true;
    const panel = lockTimeRange ? withCapturedTimeRange(built, capturedTimeRange) : built;

    const added = await addToExistingNotebook(
      open.uid,
      [{ kind: 'panel', panel, isLibraryPanel }],
      entryPoint,
      'user',
      lockTimeRange
    );

    dispatch(
      notifyApp(
        createSuccessNotification(
          t('notebooks.add-panel.success', 'Panel added to {{title}}', {
            title: added.title,
            interpolation: { escapeValue: false },
          })
        )
      )
    );
  } catch (error) {
    NotebookAnalytics.addToNotebookFailed(
      open.uid,
      entryPoint,
      NOTEBOOK_ADD_TARGET.EXISTING,
      addPanelFailureReason(error, panelWasBuilt),
      lockTimeRange
    );
    dispatch(notifyApp(createErrorNotification(addPanelErrorMessage(error))));
  }
}
