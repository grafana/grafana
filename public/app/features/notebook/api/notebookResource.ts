/**
 * Notebook resource I/O: reading and writing the `notebooks` resource itself, as opposed to the scene
 * that renders one. When the spec moves off `v2beta1` this is the file that changes, and nothing that
 * renders or serializes a notebook has to.
 */

import { API_GROUP, API_VERSION, type Notebook } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
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
    throw new Error(notebookWriteError(result.error));
  }

  const uid = result.data?.metadata?.name;
  if (!uid) {
    throw new Error('The notebook was created but the response carried no name, so it cannot be opened.');
  }

  // The route's own helper, not a path restated here: `opened` compares this against where the push
  // landed, so a second spelling of the route reports success from a page with no notebook on it.
  return { uid, url: notebookViewUrl(uid) };
}

/** The apiserver's own message: without it a caller cannot see what is wrong, and will retry the same spec. */
function notebookWriteError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data: unknown = error.data;
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }
  return 'Failed to create the notebook.';
}
