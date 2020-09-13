import { PanelModel } from '@grafana/data';
import { TextMode, TextOptions } from './types';

export const textPanelMigrationHandler = (panel: PanelModel<TextOptions>): Partial<TextOptions> => {
  // Migrates old Angular based text panel props to new props
  if (panel.hasOwnProperty('content') && panel.hasOwnProperty('mode')) {
    const oldTextPanel: { content: string; mode: string } = (panel as unknown) as any;
    const content = oldTextPanel.content;
    const mode = (oldTextPanel.mode as unknown) as TextMode;

    return { content, mode };
  }

  // The 'text' mode has been removed so we need to update any panels still using it to markdown
  if (panel.options.mode !== 'html' && panel.options.mode !== 'markdown') {
    return { content: panel.options.content, mode: 'markdown' };
  }

  return panel.options;
};
