import { t } from '@grafana/i18n';

import { createNotebook, NotebookConflictError, updateNotebookSpec } from '../api/notebookResource';
import { defaultSpec as defaultNotebookSpec, type PanelElement } from '../types';

import { appendPanelToNotebook } from './appendPanelToNotebook';

/** Enough to build the success toast and its link. */
export interface AddedToNotebook {
  uid: string;
  title: string;
}

interface CreateNotebookFields {
  title: string;
  description?: string;
  tags: string[];
}

/**
 * The two ways a panel gets into a notebook. Both are document-level: the caller is on a dashboard or
 * in Explore, so there is no NotebookScene to edit — the spec is fetched, appended to, and written
 * back whole.
 *
 * The writes themselves belong to api/notebookResource, which owns every write to the resource and is
 * the one file that changes when the spec moves off v2beta1. Nothing here touches the API client.
 */
export async function addPanelToExistingNotebook(uid: string, panel: PanelElement): Promise<AddedToNotebook> {
  const spec = await updateNotebookSpec(uid, (current) => appendPanelToNotebook(current, panel));

  return { uid, title: spec.title };
}

export async function createNotebookWithPanel(
  fields: CreateNotebookFields,
  panel: PanelElement
): Promise<AddedToNotebook> {
  const spec = appendPanelToNotebook(
    {
      ...defaultNotebookSpec(),
      title: fields.title,
      // Omitted rather than empty: description is optional in the schema, and an empty string
      // would round-trip as a description the user never wrote.
      ...(fields.description ? { description: fields.description } : {}),
      tags: fields.tags,
    },
    panel
  );

  const created = await createNotebook(spec);

  return { uid: created.uid, title: spec.title };
}

/**
 * A conflict is the one failure the user can do something about, so it gets its own wording rather
 * than the generic message. Everything else surfaces the apiserver's own message, which the resource
 * module has already extracted — a caller that sees only "something went wrong" retries the same spec.
 */
export function addPanelErrorMessage(error: unknown): string {
  if (error instanceof NotebookConflictError) {
    return t(
      'notebooks.add-panel.error-conflict',
      'This notebook changed while you were adding to it. Try again to add the panel to the latest version.'
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t('notebooks.add-panel.error-generic', 'Failed to add the panel to the notebook');
}
