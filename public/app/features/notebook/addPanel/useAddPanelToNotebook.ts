import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import {
  type NotebookSpec as ClientNotebookSpec,
  useCreateNotebookMutation,
  useLazyGetNotebookQuery,
  useReplaceNotebookMutation,
} from 'app/api/clients/dashboard/v2beta1';

import { defaultSpec as defaultNotebookSpec, type PanelElement, type Spec as NotebookSpec } from '../types';

import { appendPanelToNotebook } from './appendPanelToNotebook';

/**
 * The generated client models the spec's element union as an object with three optional keys rather
 * than as a discriminated union, and widens the closed unions in timeSettings to plain strings. Both
 * views describe the same wire JSON — they come from the same OpenAPI source — so the seam is
 * bridged here and everything either side of it uses the type that is right for it: the schema types
 * for reading and appending, the client types for the request. NotebookPageStateManager bridges the
 * same seam on the read path.
 */
function toNotebookSpec(spec: unknown): NotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client spec bridged to the schema spec
  return spec as NotebookSpec;
}

function toClientSpec(spec: NotebookSpec): ClientNotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- schema spec bridged back for the request body
  return spec as unknown as ClientNotebookSpec;
}

/** Enough to build the success toast and its link. */
export interface AddedToNotebook {
  /**
   * Absent when the create response carried no name. The panel is in the notebook either way — the
   * write succeeded — so this is not an error, there is just nowhere to link to. The toast drops its
   * link rather than offering one that goes to /notebooks/.
   */
  uid?: string;
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
 */
export function useAddPanelToNotebook() {
  const [getNotebook] = useLazyGetNotebookQuery();
  const [replaceNotebook] = useReplaceNotebookMutation();
  const [createNotebook] = useCreateNotebookMutation();

  const addToExisting = useCallback(
    async (uid: string, panel: PanelElement): Promise<AddedToNotebook> => {
      const notebook = await getNotebook({ name: uid }).unwrap();

      // Sending the fetched resource back carries its resourceVersion, so a notebook that changed
      // while the modal was open is rejected with a 409 instead of being silently overwritten.
      const updated = await replaceNotebook({
        name: uid,
        notebook: { ...notebook, spec: toClientSpec(appendPanelToNotebook(toNotebookSpec(notebook.spec), panel)) },
      }).unwrap();

      return { uid, title: updated.spec.title };
    },
    [getNotebook, replaceNotebook]
  );

  const createWithPanel = useCallback(
    async (fields: CreateNotebookFields, panel: PanelElement): Promise<AddedToNotebook> => {
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

      const created = await createNotebook({
        notebook: { metadata: { generateName: 'nb' }, spec: toClientSpec(spec) },
      }).unwrap();

      return { uid: created.metadata.name, title: created.spec.title };
    },
    [createNotebook]
  );

  return { addToExisting, createWithPanel };
}

/**
 * A conflict is the one failure the user can do something about, so it gets its own wording rather
 * than the generic message.
 */
export function addPanelErrorMessage(error: unknown): string {
  if (hasStatus(error) && error.status === 409) {
    return t(
      'notebooks.add-panel.error-conflict',
      'This notebook changed while you were adding to it. Try again to add the panel to the latest version.'
    );
  }

  return t('notebooks.add-panel.error-generic', 'Failed to add the panel to the notebook');
}

function hasStatus(error: unknown): error is { status: number | string } {
  return typeof error === 'object' && error !== null && 'status' in error;
}
