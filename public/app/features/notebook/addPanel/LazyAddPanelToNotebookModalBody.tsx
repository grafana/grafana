import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';

import { type PanelElement } from '../types';

// Both entry points — the dashboard panel menu and the Explore toolbar — sit in modules that load
// with the app, so the picker, its API client and its form are split out here rather than at either
// call site. Splitting at only one of them would leave the other pulling the whole thing into the
// main bundle for every session, including the ones that never open it.
const AddPanelToNotebookModalBody = lazy(() =>
  import('./AddPanelToNotebookModalBody').then((module) => ({ default: module.AddPanelToNotebookModalBody }))
);

interface Props {
  buildPanel: () => PanelElement;
  onDismiss: () => void;
}

export function LazyAddPanelToNotebookModalBody(props: Props) {
  return (
    <Suspense fallback={<Spinner />}>
      <AddPanelToNotebookModalBody {...props} />
    </Suspense>
  );
}

/** Shared so the dashboard's own Modal and Explore's plugin-extension modal carry the same title. */
export function addPanelToNotebookTitle(): string {
  return t('notebooks.add-panel.title', 'Add panel to notebook');
}

/**
 * Wider than the 750px default so a notebook title, its meta line and its tags fit on one row
 * without the card wrapping. Shared with Explore, whose modal chrome takes a width rather than a
 * class.
 */
export const ADD_PANEL_MODAL_WIDTH = 900;
