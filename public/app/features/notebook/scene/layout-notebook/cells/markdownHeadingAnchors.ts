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
