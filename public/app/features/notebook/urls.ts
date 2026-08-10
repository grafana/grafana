export const NOTEBOOKS_BASE_URL = '/notebooks';

/**
 * The single-notebook destination. Until a notebook editor exists this is the read-only scene
 * page, and both the list's title link and its Edit action point here — routing everything
 * through this helper keeps that one place to change once the editor lands.
 */
export function notebookViewUrl(uid: string): string {
  return `/notebook/${uid}`;
}
