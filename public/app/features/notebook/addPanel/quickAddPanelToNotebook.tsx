import { t, Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_ADD_TARGET, type NotebookEntryPoint } from '../analytics/types';
import { NotebookUnavailableError } from '../api/notebookResource';
import { type PanelElement } from '../types';
import { notebookViewHref } from '../urls';

import { addPanelErrorMessage, addPanelFailureReason, addPanelToExistingNotebook } from './addPanelToNotebook';
import { clearRecentNotebook, getRecentNotebook, setRecentNotebook } from './recentNotebook';

const inFlightAdds = new Set<string>();
const pendingWrites = new Map<string, Promise<void>>();

function enqueueNotebookWrite<T>(uid: string, write: () => Promise<T>): Promise<T> {
  const result = (pendingWrites.get(uid) ?? Promise.resolve()).then(write);
  const settled = result.then(
    () => {},
    () => {}
  );
  pendingWrites.set(uid, settled);
  void settled.then(() => {
    if (pendingWrites.get(uid) === settled) {
      pendingWrites.delete(uid);
    }
  });
  return result;
}

export async function quickAddPanelToNotebook(
  buildPanel: () => Promise<PanelElement>,
  entryPoint: NotebookEntryPoint,
  isLibraryPanel: boolean,
  openPicker: () => void,
  sourceKey: string
): Promise<void> {
  const inFlightKey = `${entryPoint}:${sourceKey}`;
  if (inFlightAdds.has(inFlightKey)) {
    return;
  }

  const recent = getRecentNotebook();
  if (!recent) {
    openPicker();
    return;
  }

  inFlightAdds.add(inFlightKey);
  let panelWasBuilt = false;

  try {
    const panel = await buildPanel();
    panelWasBuilt = true;
    const added = await enqueueNotebookWrite(recent.uid, () =>
      addPanelToExistingNotebook(recent.uid, panel, entryPoint, isLibraryPanel)
    );
    setRecentNotebook(added.uid, added.title);
    dispatch(
      notifyApp(
        createSuccessNotification(
          t('notebooks.add-panel.success', 'Panel added to {{title}}', { title: added.title }),
          '',
          undefined,
          <TextLink href={notebookViewHref(added.uid)}>
            <Trans i18nKey="notebooks.add-panel.success-link">View notebook</Trans>
          </TextLink>
        )
      )
    );
  } catch (error) {
    NotebookAnalytics.addToNotebookFailed(
      recent.uid,
      entryPoint,
      NOTEBOOK_ADD_TARGET.EXISTING,
      addPanelFailureReason(error, panelWasBuilt)
    );

    if (error instanceof NotebookUnavailableError) {
      clearRecentNotebook();
      openPicker();
    } else {
      dispatch(notifyApp(createErrorNotification(addPanelErrorMessage(error))));
    }
  } finally {
    inFlightAdds.delete(inFlightKey);
  }
}
