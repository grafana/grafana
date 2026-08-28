/**
 * Notebook resource I/O: reading and writing the `notebooks` resource itself, as opposed to the scene
 * that renders one. When the spec moves off `v2beta1` this is the file that changes, and nothing that
 * renders or serializes a notebook has to.
 */

import { API_GROUP, API_VERSION, type Notebook } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { extractErrorMessage } from 'app/api/utils';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { type Spec as NotebookSpec } from '../types';
import { notebookViewUrl } from '../urls';

/**
 * Prefix for a server-generated notebook name, as Grafana's new-dashboard save uses `generateName: 'd'`.
 * The apiserver appends a random suffix and returns the final name, so no uid is invented client-side.
 */
const NOTEBOOK_NAME_PREFIX = 'n';

const NOTEBOOK_KIND = 'Notebook';

const NOTEBOOK_API_VERSION = `${API_GROUP}/${API_VERSION}`;

export interface CreatedNotebook {
  uid: string;
  url: string;
}

/**
 * Assemble the resource envelope `transformNotebookToScene` reads, for a spec that is not coming off a
 * fetch. Only `metadata.name` and `spec` are read by the transform, and the cast is what lets the name be
 * absent for an unsaved notebook rather than `''`: a uid the scene would then carry on a field that means
 * the resource's k8s name.
 */
export function notebookResourceFor(uid: string | undefined, spec: NotebookSpec): Resource<NotebookSpec> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- in-memory envelope: the transform reads metadata.name and spec, and there is no server response to carry the rest
  return {
    apiVersion: NOTEBOOK_API_VERSION,
    kind: NOTEBOOK_KIND,
    metadata: uid ? { name: uid } : {},
    spec,
  } as Resource<NotebookSpec>;
}

/** Create a notebook and return the uid the apiserver assigned it. */
export async function createNotebook(spec: NotebookSpec): Promise<CreatedNotebook> {
  const notebook: Notebook = {
    // A k8s create body carries its own type: the apiserver will not infer them from the endpoint.
    apiVersion: NOTEBOOK_API_VERSION,
    kind: NOTEBOOK_KIND,
    metadata: { generateName: NOTEBOOK_NAME_PREFIX },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec type at the write seam
    spec: spec as unknown as Notebook['spec'],
  };

  // `track: false`: nothing renders this mutation's state, so a tracked create would leave a cache entry
  // in the store that no component subscribes to and nothing resets.
  const result = await dispatch(dashboardAPIv2beta1.endpoints.createNotebook.initiate({ notebook }, { track: false }));

  if ('error' in result && result.error) {
    throw new Error(extractErrorMessage(result.error, 'Failed to create the notebook.'));
  }

  const uid = result.data?.metadata?.name;
  if (!uid) {
    throw new Error('The notebook was created but the response carried no name, so it cannot be opened.');
  }

  // The route's own helper, not a path restated here: `opened` compares this against where the push
  // landed, so a second spelling of the route reports success from a page with no notebook on it.
  return { uid, url: notebookViewUrl(uid) };
}

/**
 * Someone else wrote to the notebook between the read and the write below. Its own type rather than a
 * status code the caller has to sniff for: this is the one write failure a user can act on, and the
 * resourceVersion that produces it is this module's business, not the caller's.
 */
export class NotebookConflictError extends Error {}

/**
 * Read-modify-write of a notebook's spec.
 *
 * The whole resource goes back, not just the spec, because that carries its `resourceVersion` — which
 * is what makes the apiserver reject a notebook someone else edited in between instead of silently
 * overwriting them. A caller that only sent the spec would win every race by accident.
 *
 * The read is deliberately uncached: a spec left over from an earlier fetch would be written straight
 * back, dropping whatever changed since.
 */
export async function updateNotebookSpec(
  uid: string,
  update: (spec: NotebookSpec) => NotebookSpec
): Promise<NotebookSpec> {
  const read = await dispatch(
    dashboardAPIv2beta1.endpoints.getNotebook.initiate({ name: uid }, { subscribe: false, forceRefetch: true })
  );

  if ('error' in read && read.error) {
    throw new Error(extractErrorMessage(read.error, 'Failed to read the notebook.'));
  }

  const current = read.data;
  if (!current) {
    throw new Error('The notebook could not be read, so the change was not applied.');
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec type at the read seam
  const next = update(current.spec as unknown as NotebookSpec);

  // `track: false` for the same reason as the create above: nothing renders this mutation's state, so
  // a tracked write parks its result in the store with no component subscribed and nothing to reset
  // it - and for a PUT that result is the whole notebook the server echoed back. The invalidation
  // that drops this notebook's cached GET is unaffected: RTK Query keys tag invalidation off the
  // thunk being fulfilled, not off `track`.
  const result = await dispatch(
    dashboardAPIv2beta1.endpoints.replaceNotebook.initiate(
      {
        name: uid,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec type at the write seam
        notebook: { ...current, spec: next as unknown as Notebook['spec'] },
      },
      { track: false }
    )
  );

  if ('error' in result && result.error) {
    if (isConflict(result.error)) {
      throw new NotebookConflictError(
        extractErrorMessage(result.error, 'The notebook changed while you were editing.')
      );
    }
    throw new Error(extractErrorMessage(result.error, 'Failed to save the notebook.'));
  }

  return next;
}

/**
 * Replace an existing notebook's spec, leaving its metadata alone.
 *
 * A JSON patch replacing all of `/spec`, not a merge patch: `spec.elements` is a keyed map, so a merge
 * would leave a deleted cell's element behind. Not a PUT either, which would replace metadata and strip
 * the notebook's folder annotation. Full reasoning in the spec, section 5.1.
 *
 * `generation` is optional rather than defaulted to 0, because the caller compares it with `===` against
 * an optional field and a 0 would read as a difference.
 */
export async function updateNotebook(uid: string, spec: NotebookSpec): Promise<{ generation?: number }> {
  const result = await dispatch(
    dashboardAPIv2beta1.endpoints.updateNotebook.initiate(
      // `createBaseQuery` infers the json-patch content type from the array of ops.
      { name: uid, patch: [{ op: 'replace', path: '/spec', value: spec }] },
      // Untracked like the create: nothing renders this mutation's state, and autosave writes often.
      { track: false }
    )
  );

  if ('error' in result && result.error) {
    throw new Error(extractErrorMessage(result.error, 'Failed to save the notebook.'));
  }

  return { generation: result.data?.metadata?.generation };
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}
