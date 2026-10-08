import { type PageIdentity } from './types';

/**
 * Maps a base-url-less pathname to the page it belongs to, or `null` for pages that are not worth
 * resuming (home, browse pages, settings, ...). First matching rule wins.
 */
export function classifyPage(pathname: string): PageIdentity | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [, first, second] = normalized.split('/');

  if (first === 'd' && second) {
    return { kind: 'dashboard', uid: second, pathname: normalized };
  }

  if (normalized === '/explore') {
    return { kind: 'explore', pathname: normalized };
  }

  if (first === 'a' && second) {
    return { kind: 'app', pathname: normalized };
  }

  if (first === 'alerting') {
    return { kind: 'alerting', pathname: normalized };
  }

  return null;
}

/** Dedupe key: two URLs with the same key are the same history row. */
export function pageKey(page: PageIdentity): string {
  switch (page.kind) {
    case 'dashboard':
      return `dashboard:${page.uid}`;
    case 'explore':
      return 'explore';
    case 'alerting':
    case 'app':
      return page.pathname;
  }
}
