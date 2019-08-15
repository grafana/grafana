import marked, { MarkedOptions } from 'marked';

const defaultMarkedOptions: MarkedOptions = {
  renderer: new marked.Renderer(),
  pedantic: false,
  gfm: true,
  tables: true,
  sanitize: true,
  smartLists: true,
  smartypants: false,
  xhtml: false,
};

export function setMarkdownOptions(optionsOverride?: MarkedOptions) {
  marked.setOptions({ ...defaultMarkedOptions, ...optionsOverride });
}

export function renderMarkdown(str?: string): string {
  return marked(str || '');
}
