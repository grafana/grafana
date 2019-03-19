export interface TextOptions {
  mode: 'html' | 'markdown' | 'text';
  content: string;
}

export const defaults: TextOptions = {
  mode: 'markdown',
  content: `# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)


`,
};
