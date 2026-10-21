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

import { addPanelErrorMessage, addPanelFailureReason, addToExistingNotebook } from './addPanelToNotebook';
import { clearRecentNotebook, getRecentNotebook, setRecentNotebook } from './recentNotebook';

const inFlightAdds = new Set<string>();
const pendingWrites = new Map<string, { settled: Promise<void>; unavailable: boolean }>();

function enqueueNotebookWrite<T>(uid: string, write: () => Promise<T>): Promise<T | undefined> {
  const queue = pendingWrites.get(uid) ?? { settled: Promise.resolve(), unavailable: false };
  const result = queue.settled.then(async () => {
    if (queue.unavailable) {
      return undefined;
    }

    try {
      return await write();
    } catch (error) {
      if (error instanceof NotebookUnavailableError) {
        queue.unavailable = true;
      }
      throw error;
    }
  });
  const settled = result.then(
    () => {},
    () => {}
  );
  queue.settled = settled;
  pendingWrites.set(uid, queue);
  void settled.then(() => {
    if (pendingWrites.get(uid)?.settled === settled) {
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
  let lockTimeRange = false;

  try {
    const panel = await buildPanel();
    panelWasBuilt = true;
    lockTimeRange =
      panel.kind === 'Panel' &&
      Boolean(panel.spec.data.spec.queryOptions.timeFrom && panel.spec.data.spec.queryOptions.timeTo);
    const added = await enqueueNotebookWrite(recent.uid, () =>
      addToExistingNotebook(recent.uid, [{ kind: 'panel', panel, isLibraryPanel }], entryPoint, 'user', lockTimeRange)
    );
    if (!added) {
      return;
    }
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
      addPanelFailureReason(error, panelWasBuilt),
      lockTimeRange
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
