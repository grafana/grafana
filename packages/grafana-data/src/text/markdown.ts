import { marked } from 'marked';
import { mangle } from 'marked-mangle';

import { sanitizeTextPanelContent } from './sanitize';

let hasInitialized = false;

export interface RenderMarkdownOptions {
  noSanitize?: boolean;
  breaks?: boolean;
}

const markdownOptions = {
  headerIds: false,
  pedantic: false,
  gfm: true,
  smartLists: true,
  smartypants: false,
  xhtml: false,
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
  if (options?.noSanitize) {
    return html;
  }

  return sanitizeTextPanelContent(html);
}
