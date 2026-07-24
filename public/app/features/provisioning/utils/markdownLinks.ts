import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoFileUrl, getRepoRawFileUrl } from './git';

interface RewriteOptions {
  repository: RepositoryView;
  /** Repo-relative directory containing the README (e.g. "ops/resources/RnD"). */
  baseDirInRepo: string;
}

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*:/i;

/**
 * Attribute stamped on links whose target could be a Grafana resource (JSON/YAML
 * files or folder directories), carrying the resolved repo path. The README click
 * handler reads it to lazily resolve the link to the in-app page — untagged links
 * (docs, images, external) always open the host URL.
 */
export const RESOURCE_PATH_ATTR = 'data-provisioning-repo-path';

/**
 * Walk the rendered Markdown HTML and rewrite relative URLs (`<a href>` and
 * `<img src>`) to absolute URLs that point back to the host repository.
 * Same-page anchors (`#…`) and already-absolute URLs are left untouched.
 *
 * Links go to the host's web view (blob/tree). Images go to the host's raw
 * file URL so they actually render inline.
 *
 * Best-effort: if the host doesn't have a known URL pattern (e.g. local
 * repos), the broken relative attribute is removed so it doesn't render as
 * a clickable but non-functional link or a broken image with the relative
 * path leaking into the page.
 */
export function rewriteRelativeMarkdownLinks(html: string, options: RewriteOptions): string {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href || isAbsoluteUrl(href) || href.startsWith('#')) {
      return;
    }

    const result = resolveRepoRelativePath(options.baseDirInRepo, href);
    if (!result) {
      return;
    }

    const absolute = getRepoFileUrl({
      repoType: options.repository.type,
      url: options.repository.url,
      branch: options.repository.branch,
      filePath: result.path,
    });

    if (absolute) {
      anchor.setAttribute('href', absolute + result.suffix);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    } else {
      // No host link pattern (e.g. local repo) — strip the broken relative
      // href so it doesn't render as a clickable but non-functional link.
      anchor.removeAttribute('href');
    }

    // Tag JSON/YAML/folder links so the README click handler can resolve them to
    // the in-app Grafana page. Done regardless of the host URL so links in repos
    // without one (local/git) still resolve via the resource listing.
    if (isResourceLinkCandidate(result.path)) {
      anchor.setAttribute(RESOURCE_PATH_ATTR, result.path);
    }
  });

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || isAbsoluteUrl(src)) {
      return;
    }

    const result = resolveRepoRelativePath(options.baseDirInRepo, src);
    if (!result) {
      return;
    }

    const absolute = getRepoRawFileUrl({
      repoType: options.repository.type,
      url: options.repository.url,
      branch: options.repository.branch,
      filePath: result.path,
    });

    if (absolute) {
      img.setAttribute('src', absolute + result.suffix);
    } else {
      // Strip a broken relative src so the alt text takes over instead of a
      // broken-image icon pointing at the Grafana app's own URL space.
      img.removeAttribute('src');
    }
  });

  return doc.body.innerHTML;
}

function isAbsoluteUrl(url: string): boolean {
  return SCHEME_RE.test(url) || url.startsWith('//');
}

/**
 * Resolve a relative path against the README's directory inside the repo.
 * `/foo` is treated as repo-root-relative. Trailing slashes are preserved so
 * directories produce a tree URL upstream.
 */
function resolveRepoRelativePath(baseDir: string, relPath: string): { path: string; suffix: string } | undefined {
  // Split off query/fragment suffix while preserving it for later reattachment.
  const suffixIdx = relPath.search(/[?#]/);
  const pathPart = suffixIdx === -1 ? relPath : relPath.slice(0, suffixIdx);
  const suffix = suffixIdx === -1 ? '' : relPath.slice(suffixIdx);

  if (!pathPart) {
    return undefined;
  }

  // Decode percent-escapes so downstream encodeURIComponent doesn't double-encode.
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    decoded = pathPart;
  }

  const trailingSlash = decoded.endsWith('/') ? '/' : '';

  if (decoded.startsWith('/')) {
    return { path: stripLeadingSlashes(decoded), suffix };
  }

  const baseParts = baseDir.split('/').filter(Boolean);
  const relParts = decoded.split('/');
  const stack = [...baseParts];

  for (const part of relParts) {
    if (part === '..') {
      stack.pop();
    } else if (part !== '.' && part !== '') {
      stack.push(part);
    }
  }

  if (stack.length === 0) {
    return trailingSlash ? { path: trailingSlash, suffix } : undefined;
  }
  return { path: stack.join('/') + trailingSlash, suffix };
}
function stripLeadingSlashes(s: string): string {
  return s.replace(/^\/+/, '');
}

/**
 * Whether a resolved repo path could map to a Grafana resource: a JSON/YAML file
 * (dashboard, playlist, folder metadata, ...) or a folder directory. Folders are
 * matched by their trailing slash — which the resolver preserves for directory
 * links — rather than by "no extension", so extensionless files (README,
 * LICENSE, Makefile) aren't tagged and never trigger a resource lookup. Links
 * that fail this (docs, images, arbitrary files) are left as plain host links.
 */
export function isResourceLinkCandidate(path: string): boolean {
  if (path.endsWith('/')) {
    return true;
  }
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  return /\.(json|ya?ml)$/i.test(lastSegment);
}
