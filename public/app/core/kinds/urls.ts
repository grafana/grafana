import { config } from '@grafana/runtime';
import kbn from 'app/core/utils/kbn';

import { type KindInfo } from './types';

type KindWithPage = KindInfo & { url: string };

/**
 * The in-app path of the page for one object, for router navigation. A `title` adds the slug to
 * kinds whose pages take one. Undefined for a kind that has no page for a single object.
 */
export function kindPath(kind: KindWithPage, name: string, title?: string): string;
export function kindPath(kind: KindInfo, name: string, title?: string): string | undefined;
export function kindPath(kind: KindInfo, name: string, title?: string): string | undefined {
  if (!kind.url) {
    return undefined;
  }
  const path = kind.url.replace('{name}', encodeURIComponent(name));
  return kind.titleSlug && title !== undefined ? `${path}/${kbn.slugifyForUrl(title)}` : path;
}

/** {@link kindPath} under the app sub path, for a raw `href`. */
export function kindHref(kind: KindWithPage, name: string, title?: string): string;
export function kindHref(kind: KindInfo, name: string, title?: string): string | undefined;
export function kindHref(kind: KindInfo, name: string, title?: string): string | undefined {
  const path = kindPath(kind, name, title);
  return path === undefined ? undefined : `${config.appSubUrl}${path}`;
}
