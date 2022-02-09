import { marked } from 'marked';
import { sanitize, sanitizeTextPanelContent } from './sanitize';

let hasInitialized = false;

export interface RenderMarkdownOptions {
  noSanitize?: boolean;
}

const markdownOptions = {
  pedantic: false,
  gfm: true,
  smartLists: true,
  smartypants: false,
  xhtml: false,
};

export function renderMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.setOptions({ ...markdownOptions });
    hasInitialized = true;
  }

  const html = marked(str || '');
  if (options?.noSanitize) {
    return html;
  }

  return sanitize(html);
}

export function renderTextPanelMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.setOptions({ ...markdownOptions });
    hasInitialized = true;
  }

  const html = marked(str || '');
  if (options?.noSanitize) {
    return html;
  }

  return sanitizeTextPanelContent(html);
}
