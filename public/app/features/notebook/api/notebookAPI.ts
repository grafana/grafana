import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { setLastUsedNotebook } from '../model/lastUsedNotebook';
import { markNotebookAsNew } from '../model/newNotebookSignal';
import { normalizeNotebookSpec } from '../model/notebookSpec';

// The generated RTK types and the @grafana/schema notebook types are produced from the same
// OpenAPI source and are structurally identical at runtime. The rest of the notebook feature
// works with the schema types (same convention as NotebookScenePageStateManager), so all
// casting between the two happens here, at the API seam.

export function notebookViewUrl(uid: string): string {
  return `/notebook/${uid}`;
}

export function notebookEditUrl(uid: string): string {
  return `/notebooks/edit/${uid}`;
}

export async function fetchNotebook(uid: string): Promise<Resource<NotebookSpec>> {
  const result = await dispatch(
    dashboardAPIv2beta1.endpoints.getNotebook.initiate({ name: uid }, { subscribe: false, forceRefetch: true })
  );
  if ('error' in result && result.error) {
    throw result.error;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
  const resource = result.data as unknown as Resource<NotebookSpec>;
  // RTK Query freezes cached responses (Immer); clone so editor mutations stay safe.
  const mutable = structuredClone(resource);
  return { ...mutable, spec: normalizeNotebookSpec(mutable.spec) };
}

export async function createNotebook(spec: NotebookSpec): Promise<Resource<NotebookSpec>> {
  const result = await dispatch(
    dashboardAPIv2beta1.endpoints.createNotebook.initiate({
      notebook: {
        metadata: { generateName: 'nb' },
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- schema spec bridged to the generated client type at the API seam
        spec: spec as unknown as Parameters<
          typeof dashboardAPIv2beta1.endpoints.createNotebook.initiate
        >[0]['notebook']['spec'],
      },
    })
  );
  if ('error' in result && result.error) {
    throw result.error;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
  const created = result.data as unknown as Resource<NotebookSpec>;
  setLastUsedNotebook(created.metadata.name, created.spec.title);
  return created;
}

export async function saveNotebook(resource: Resource<NotebookSpec>): Promise<Resource<NotebookSpec>> {
  const result = await dispatch(
    dashboardAPIv2beta1.endpoints.replaceNotebook.initiate({
      name: resource.metadata.name,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- schema resource bridged to the generated client type at the API seam
      notebook: resource as unknown as Parameters<
        typeof dashboardAPIv2beta1.endpoints.replaceNotebook.initiate
      >[0]['notebook'],
    })
  );
  if ('error' in result && result.error) {
    throw result.error;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
  const saved = result.data as unknown as Resource<NotebookSpec>;
  setLastUsedNotebook(saved.metadata.name, saved.spec.title);
  return saved;
}

/**
 * Creates a copy of a notebook under a new title. The copy is marked as freshly
 * created so opening it in the editor focuses the title, ready to rename.
 */
export async function duplicateNotebook(spec: NotebookSpec, copyTitle: string): Promise<Resource<NotebookSpec>> {
  const copy: NotebookSpec = JSON.parse(JSON.stringify(spec));
  copy.title = copyTitle;
  const created = await createNotebook(copy);
  markNotebookAsNew(created.metadata.name);
  return created;
}

export async function deleteNotebook(uid: string): Promise<void> {
  const result = await dispatch(dashboardAPIv2beta1.endpoints.deleteNotebook.initiate({ name: uid }));
  if ('error' in result && result.error) {
    throw result.error;
  }
}

/** True when the error is a 409 optimistic-concurrency conflict from the apiserver. */
export function isConflictError(error: unknown): boolean {
  return typeof error === 'object' && error != null && 'status' in error && error.status === 409;
}
