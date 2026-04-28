import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoLinkUrl, getRepoRawFileUrl } from './git';

interface RewriteOptions {
  repository: RepositoryView;
  /** Repo-relative directory containing the README (e.g. "ops/resources/RnD"). */
  baseDirInRepo: string;
}

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*:/i;

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

    const targetPath = resolveRepoRelativePath(options.baseDirInRepo, href);
    if (!targetPath) {
      return;
    }

    const absolute = getRepoLinkUrl({
      repoType: options.repository.type,
      url: options.repository.url,
      branch: options.repository.branch,
      filePath: targetPath,
    });

    if (absolute) {
      anchor.setAttribute('href', absolute);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    } else {
      // No host link pattern (e.g. local repo) — strip the broken relative
      // href so it doesn't render as a clickable but non-functional link.
      anchor.removeAttribute('href');
    }
  });

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || isAbsoluteUrl(src)) {
      return;
    }

    const targetPath = resolveRepoRelativePath(options.baseDirInRepo, src);
    if (!targetPath) {
      return;
    }

    const absolute = getRepoRawFileUrl({
      repoType: options.repository.type,
      url: options.repository.url,
      branch: options.repository.branch,
      filePath: targetPath,
    });

    if (absolute) {
      img.setAttribute('src', absolute);
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
function resolveRepoRelativePath(baseDir: string, relPath: string): string | undefined {
  const trimmedRel = relPath.split('?')[0].split('#')[0];
  if (!trimmedRel) {
    return undefined;
  }

  const trailingSlash = trimmedRel.endsWith('/') ? '/' : '';

  if (trimmedRel.startsWith('/')) {
    return stripLeadingSlashes(trimmedRel);
  }

  const baseParts = baseDir.split('/').filter(Boolean);
  const relParts = trimmedRel.split('/');
  const stack = [...baseParts];

  for (const part of relParts) {
    if (part === '..') {
      stack.pop();
    } else if (part !== '.' && part !== '') {
      stack.push(part);
    }
  }

  if (stack.length === 0) {
    return trailingSlash || undefined;
  }
  return stack.join('/') + trailingSlash;
}

function stripLeadingSlashes(s: string): string {
  return s.replace(/^\/+/, '');
}
