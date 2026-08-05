/**
 * Notebook resource I/O: reading and writing the `notebooks` resource itself, as opposed to the
 * scene that renders one.
 *
 * Kept in the notebook feature rather than beside the mutation command that calls it, so the resource
 * stays owned by one module: the page loader, the create command and whatever the notebook editor
 * eventually saves through all go through here. When the spec moves off `v2beta1` this is the file
 * that changes, and nothing that renders or serializes a notebook has to.
 */

import { API_GROUP, API_VERSION, type Notebook } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { dispatch } from 'app/store/store';

/**
 * Prefix for a server-generated notebook name. Grafana's own new-dashboard save uses `generateName:
 * 'd'`, so notebooks take `n`: the apiserver appends a random suffix and returns the final name,
 * which is what avoids inventing a uid client-side and colliding with one.
 */
const NOTEBOOK_NAME_PREFIX = 'n';

const NOTEBOOK_KIND = 'Notebook';

/** Where a notebook renders, matching the `/notebook/:uid/:slug?` route. */
export function notebookPageUrl(uid: string): string {
  return `/notebook/${encodeURIComponent(uid)}`;
}

export interface CreatedNotebook {
  uid: string;
  url: string;
}

/**
 * Create a notebook and return the uid the apiserver assigned it.
 *
 * A notebook has no blank-editor route to apply a spec into, the way `/dashboard/new` is one for a
 * dashboard, so creating one is this request rather than a navigation followed by an in-scene write.
 * Which also means a create is persisted immediately, unlike every other write on this surface.
 */
export async function createNotebook(spec: NotebookSpec): Promise<CreatedNotebook> {
  const notebook: Notebook = {
    // A k8s create body carries its own type: the apiserver rejects a POST without them rather than
    // inferring them from the endpoint.
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: NOTEBOOK_KIND,
    metadata: { generateName: NOTEBOOK_NAME_PREFIX },
    // The generated client's spec type and the schema one come from the same OpenAPI source; bridge
    // at this seam so callers stay on the @grafana/schema types the scene layer speaks.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec type at the write seam
    spec: spec as unknown as Notebook['spec'],
  };

  const result = await dispatch(dashboardAPIv2beta1.endpoints.createNotebook.initiate({ notebook }));

  if ('error' in result && result.error) {
    throw new Error(notebookWriteError(result.error));
  }

  const uid = result.data?.metadata?.name;
  if (!uid) {
    throw new Error('The notebook was created but the response carried no name, so it cannot be opened.');
  }

  return { uid, url: notebookPageUrl(uid) };
}

/**
 * The apiserver's own message for a rejected write, which is the one that says what is wrong with the
 * spec. Without it a caller only learns that something failed, and a caller that cannot see why
 * cannot correct the spec and will retry the same one.
 */
function notebookWriteError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data: unknown = error.data;
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }
  return 'Failed to create the notebook.';
}
