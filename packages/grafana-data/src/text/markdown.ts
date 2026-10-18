import { marked, type MarkedOptions, type MarkedExtension } from 'marked';
import { mangle } from 'marked-mangle';

import { sanitizeTextPanelContent } from './sanitize';

let hasInitialized = false;

export interface RenderMarkdownOptions {
  noSanitize?: boolean;
  breaks?: boolean;
}

const markdownOptions: MarkedOptions = {
  pedantic: false,
  gfm: true,
  breaks: false,
};

const admonitions: MarkedExtension = {
  renderer: {
    blockquote(token) {
      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/.exec(token.text);
      if (!match) {
        return false;
      }

      const kind = match[1].toLowerCase();
      const title = kind[0].toUpperCase() + kind.slice(1);
      const [first, ...rest] = token.tokens;
      if (first?.type !== 'paragraph' || !first.tokens || first.tokens[0]?.type !== 'text') {
        return false;
      }
      // Keep the original tokens so document-level reference links remain resolved.
      const [marker, ...inline] = first.tokens;
      if (marker.raw.length < match[0].length && inline[0]?.type === 'br') {
        inline.shift();
      }
      const remainingText = marker.text.slice(match[0].length);
      const tokens =
        remainingText || inline.length
          ? [{ ...first, tokens: [{ ...marker, text: remainingText }, ...inline] }, ...rest]
          : rest;
      const body = this.parser.parse(tokens);
      // HTML consumers retain readable content; the UI renderer upgrades these markers to Alerts.
      return `<blockquote class="grafana-markdown-alert-${kind}"><p>${title}</p><div class="grafana-markdown-alert-body">${body}</div></blockquote>\n`;
    },
  },
};

export function renderMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.use(mangle(), admonitions);
    marked.setOptions({ ...markdownOptions });
    hasInitialized = true;
  }

  let opts = undefined;
  if (options?.breaks) {
    opts = {
      ...markdownOptions,
      breaks: true,
    };
  }
  const html = marked(str || '', opts);

  // `marked()` returns a promise if using any extensions that require async processing.
  // we don't use any async extensions, but there is no way for typescript to know this, so we need to check the type.
  if (typeof html !== 'string') {
    throw new Error('Failed to process markdown synchronously.');
  }

  if (options?.noSanitize) {
    return html;
  }

  return sanitizeTextPanelContent(html);
}

export function renderTextPanelMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.use(mangle(), admonitions);
    marked.setOptions({ ...markdownOptions });
    hasInitialized = true;
  }

  const html = marked(str || '');

  // `marked()` returns a promise if using any extensions that require async processing.
  // we don't use any async extensions, but there is no way for typescript to know this, so we need to check the type.
  if (typeof html !== 'string') {
    throw new Error('Failed to process markdown synchronously.');
  }

  if (options?.noSanitize) {
    return html;
  }

  return sanitizeTextPanelContent(html);
}
