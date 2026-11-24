import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';

import { textUtil } from '@grafana/data';

/**
 * Tags the report renderer can emit. Anything else (raw HTML, images, embeds,
 * tables) is escaped or dropped before it reaches the page.
 */
const ALLOWED_TAGS = ['p', 'br', 'em', 'strong', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'];
const ALLOWED_ATTR = ['href', 'title', 'rel', 'start'];

const URL_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const SAFE_SCHEME = /^(https?|mailto)$/i;

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  const scheme = URL_SCHEME.exec(trimmed)?.[1];
  // Scheme-less hrefs ("/d/abc", "#section", "d/abc") resolve against the current page.
  return scheme === undefined ? !trimmed.startsWith('//') : SAFE_SCHEME.test(scheme);
}

const escape = textUtil.escapeHtml;

const reportMarked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Raw HTML is shown as text so authors see what they typed instead of a silent drop.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escape(text);
    },
    // Remote images are never loaded; keep the alt text in the flow.
    image({ text }: Tokens.Image) {
      return escape(text);
    },
    // Headings inside a summary would compete with the section heading and break the document outline.
    heading({ tokens }: Tokens.Heading) {
      return `<p><strong>${this.parser.parseInline(tokens)}</strong></p>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      if (!isSafeHref(href)) {
        return label;
      }
      const titleAttr = title ? ` title="${escape(title)}"` : '';
      return `<a href="${escape(href)}"${titleAttr} rel="noopener noreferrer">${label}</a>`;
    },
  },
});

/**
 * Renders report prose: paragraphs, emphasis, lists, code spans, and safe links.
 * The source is never interpolated and the output never references remote resources.
 */
export function renderReportMarkdown(source: string | undefined): string {
  if (!source?.trim()) {
    return '';
  }

  const html = reportMarked.parse(source, { async: false });
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
}
