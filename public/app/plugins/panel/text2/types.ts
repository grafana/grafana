export type TextMode = 'html' | 'markdown' | 'text';
export interface TextOptions {
  mode: TextMode;
  content: string;
}
