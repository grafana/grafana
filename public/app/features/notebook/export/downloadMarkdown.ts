import { saveAs } from 'file-saver';

import { dateTimeFormat } from '@grafana/data';
import kbn from 'app/core/utils/kbn';

// Long titles are rare, but a filename over the filesystem's ~255-byte limit fails the save
// outright, so the slug is bounded.
const MAX_SLUG_LENGTH = 60;

/**
 * Saves the markdown as a `.md` file, named after the notebook and the moment it was exported —
 * the same convention as `downloadAsJson` in the inspector.
 *
 * Uses file-saver rather than a hand-rolled anchor: Grafana installs a global link handler that
 * calls preventDefault on link activations, which cancels a naive `<a download>` click.
 */
export function downloadMarkdown(markdown: string, title: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });

  saveAs(blob, `${slugifyTitle(title) || 'notebook'}-${dateTimeFormat(new Date())}.md`);
}

function slugifyTitle(title: string): string {
  // kbn.slugifyForUrl is what dashboard exports and provisioning already name files with; it can
  // leave a leading or trailing dash behind for a title that starts or ends in punctuation.
  const slug = kbn.slugifyForUrl(title).replace(/^-+|-+$/g, '');

  return slug.length <= MAX_SLUG_LENGTH
    ? slug
    : // Trim a separator left dangling by the cut, so the name never ends in '-'.
      slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
}
