import config from 'app/core/config';
import marked from 'marked';

const options: any = {
  renderer: new marked.Renderer(),
  pedantic: false,
  gfm: true,
  tables: true,
  sanitize: !config.disableSanitizeHtml,
  smartLists: true,
  smartypants: false,
  xhtml: false,
};

marked.setOptions(options);

export function renderMarkdown(str: string): string {
  return marked(str);
}
