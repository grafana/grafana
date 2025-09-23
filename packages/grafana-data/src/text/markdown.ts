import { marked, MarkedOptions } from 'marked';
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

export function renderMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.use(mangle());
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
    marked.use(mangle());
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
