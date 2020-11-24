import { PanelModel } from '@grafana/data';
import { TextMode, TextOptions } from './types';

export const textPanelMigrationHandler = (panel: PanelModel<TextOptions>): Partial<TextOptions> => {
  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  let options = panel.options;

  // Migrates old Angular based text panel props to new props
  if (panel.hasOwnProperty('content') && panel.hasOwnProperty('mode')) {
    const oldTextPanel: any = panel as any;
    const content = oldTextPanel.content;
    const mode = oldTextPanel.mode as TextMode;

    delete oldTextPanel.content;
    delete oldTextPanel.mode;

    if (previousVersion < 7.1) {
      options = { content, mode };
    }
  }

  // The 'text' mode has been removed so we need to update any panels still using it to markdown
  if (options.mode !== 'html' && options.mode !== 'markdown') {
    options = { ...options, mode: 'markdown' };
  }

  return options;
};
