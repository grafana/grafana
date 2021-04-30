//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const modelVersion = Object.freeze([1, 0]);

export enum TextMode {
  HTML = 'html',
  Markdown = 'markdown',
}

export interface PanelOptions {
  mode: TextMode;
  content: string;
}

export const defaultPanelOptions: PanelOptions = {
  mode: TextMode.Markdown,
  content: `# Title

  For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
           `,
};
