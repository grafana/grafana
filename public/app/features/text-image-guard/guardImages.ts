import { type BlockedImage, type UrlSegment } from './imageGuardStore';

/** Fails to decode without a network request, so the browser shows its broken-image icon. */
export const BLOCKED_IMAGE_SRC = 'data:,';

// ${var}, $var, [[var]] and Handlebars {{...}} / {{{...}}}.
const PLACEHOLDER = /\$\{[^}]*\}|\$\w+|\[\[[^\]]*\]\]|\{\{\{?[^}]*\}?\}\}/g;
const HTML_IMG_SRC = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;
const MARKDOWN_IMG_SRC = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;

interface SrcPattern {
  regex: RegExp;
  hasPlaceholders: boolean;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Turns each image src in the raw template into a regex whose groups capture the interpolated parts. */
function getSrcPatterns(template: string): SrcPattern[] {
  const sources = [
    ...Array.from(template.matchAll(HTML_IMG_SRC), (m) => m[2]),
    ...Array.from(template.matchAll(MARKDOWN_IMG_SRC), (m) => m[1]),
  ];

  return sources.map((src) => {
    const literals = src.split(PLACEHOLDER).map(escapeRegex);
    return {
      regex: new RegExp(`^${literals.join('(.*?)')}$`, 's'),
      hasPlaceholders: literals.length > 1,
    };
  });
}

function splitUrl(url: string, patterns: SrcPattern[]): Pick<BlockedImage, 'segments' | 'containsQueryData'> {
  for (const { regex, hasPlaceholders } of patterns) {
    const match = regex.exec(url);
    if (!match) {
      continue;
    }

    if (!hasPlaceholders) {
      return { segments: [{ text: url, fromData: false }], containsQueryData: false };
    }

    const segments: UrlSegment[] = [];
    let cursor = 0;
    // Groups are captured in order, so walk the URL and slice literal text between them.
    for (const captured of match.slice(1)) {
      const start = url.indexOf(captured, cursor);
      if (start > cursor) {
        segments.push({ text: url.slice(cursor, start), fromData: false });
      }
      if (captured) {
        segments.push({ text: captured, fromData: true });
      }
      cursor = start + captured.length;
    }
    if (cursor < url.length) {
      segments.push({ text: url.slice(cursor), fromData: false });
    }
    return { segments, containsQueryData: segments.some((s) => s.fromData) };
  }

  // Not traceable to the template, e.g. the whole tag came from a variable, so treat it as data.
  return { segments: [{ text: url, fromData: true }], containsQueryData: true };
}

function resolveCrossOrigin(src: string): URL | undefined {
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.origin === window.location.origin ? undefined : url;
  } catch {
    return undefined;
  }
}

export interface GuardedHtml {
  html: string;
  blocked: BlockedImage[];
}

/**
 * Swaps the src of every cross-origin image whose host isn't allowed for a broken placeholder.
 * Parsing happens in an inert document, so blocked images never start loading.
 */
export function guardImages(html: string, template: string, allowedHosts: ReadonlySet<string>): GuardedHtml {
  if (!/<img\b/i.test(html)) {
    return { html, blocked: [] };
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const patterns = getSrcPatterns(template);
  const blocked: BlockedImage[] = [];

  for (const img of Array.from(doc.body.querySelectorAll('img'))) {
    const src = img.getAttribute('src');
    const url = src ? resolveCrossOrigin(src) : undefined;
    if (!src || !url || allowedHosts.has(url.hostname)) {
      continue;
    }

    blocked.push({ url: src, host: url.hostname, ...splitUrl(src, patterns) });
    img.setAttribute('data-blocked-src', src);
    img.setAttribute('src', BLOCKED_IMAGE_SRC);
    img.removeAttribute('srcset');
  }

  if (blocked.length === 0) {
    return { html, blocked };
  }

  return { html: doc.body.innerHTML, blocked };
}
