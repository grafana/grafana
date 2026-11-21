/**
 * Gives rendered markdown's headings the ids a table of contents links to.
 *
 * `marked` leaves headings without ids, so a hand-written `[Section](#section)` in one cell had
 * nothing to jump to. Slugs follow GitHub's rules, which is what authors copy from their editor:
 * lower case, punctuation dropped, spaces turned into hyphens ("Sun & Wind" -> "sun--wind-assessment").
 */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

export function addHeadingIds(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const used = new Set<string>();

  doc.body.querySelectorAll(HEADING_SELECTOR).forEach((heading) => {
    const base = slugifyHeading(heading.textContent ?? '');
    if (!base) {
      return;
    }

    // Repeated headings in one cell get the same `-1`, `-2` suffixes GitHub gives them, so a link to
    // the second one resolves to the second one.
    let id = base;
    for (let suffix = 1; used.has(id); suffix++) {
      id = `${base}-${suffix}`;
    }
    used.add(id);
    heading.id = id;
  });

  return doc.body.innerHTML;
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * The heading id a url fragment points at, or undefined when the fragment is not one.
 *
 * The decode is guarded: a link whose fragment is malformed percent-encoding (say `#%`) is the
 * author's mistake, not a reason for the click handler to throw, so the raw text is used instead.
 */
export function headingIdFromHash(hash: string): string | undefined {
  if (!hash.startsWith('#')) {
    return undefined;
  }

  const fragment = hash.slice(1);
  try {
    return decodeURIComponent(fragment) || undefined;
  } catch {
    return fragment || undefined;
  }
}
