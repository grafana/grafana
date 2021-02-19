export type TextMode = 'html' | 'markdown' | 'text';
export interface TextOptions {
  mode: TextMode;
  content: string;
}

export const defaults: TextOptions = {
  mode: 'markdown',
  content: `# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)


`,
};
