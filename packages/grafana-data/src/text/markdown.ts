import { marked } from 'marked';
import { sanitize } from './sanitize';

let hasInitialized = false;

export interface RenderMarkdownOptions {
  noSanitize?: boolean;
}

export function renderMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.setOptions({
      pedantic: false,
      gfm: true,
      smartLists: true,
      smartypants: false,
      xhtml: false,
    });
    hasInitialized = true;
  }

  const html = marked(str || '');
  if (options?.noSanitize) {
    return html;
  }

  return sanitize(html);
}

// Markdown for Grafana Chats only!
export function renderChatMarkdown(str?: string, options?: RenderMarkdownOptions): string {
  if (!hasInitialized) {
    marked.setOptions({
      pedantic: false,
      gfm: true,
      smartLists: true,
      smartypants: false,
      xhtml: false,
      breaks: true,
    });
    hasInitialized = true;
  }

  const html = marked(str || '');
  if (options?.noSanitize) {
    return html;
  }

  return sanitize(html);
}
