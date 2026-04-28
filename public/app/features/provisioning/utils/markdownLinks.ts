import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoLinkUrl } from './git';

interface RewriteOptions {
  repository: RepositoryView;
  /** Repo-relative directory containing the README (e.g. "ops/resources/RnD"). */
  baseDirInRepo: string;
}

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*:/i;

/**
 * Walk the rendered Markdown HTML and rewrite relative `<a href>` to absolute
 * URLs that point back to the host repository. Same-page anchors (`#…`) and
 * already-absolute URLs are left untouched.
 *
 * Best-effort: if the host doesn't have a known link URL pattern (e.g. local
 * repos), the link is dropped to plain text so it doesn't render as a broken
 * relative link inside the Grafana app.
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
