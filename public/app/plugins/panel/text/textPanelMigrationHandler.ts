import { PanelModel } from '@grafana/data';

import { TextMode, Options } from './panelcfg.gen';

export const textPanelMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  let options = panel.options;

  // Migrates old Angular based text panel props to new props
  if (panel.hasOwnProperty('content') && panel.hasOwnProperty('mode')) {
    const oldTextPanel: any = panel;
    const content = oldTextPanel.content;
    const mode: TextMode = oldTextPanel.mode;

    delete oldTextPanel.content;
    delete oldTextPanel.mode;

    if (previousVersion < 7.1) {
      options = { content, mode };
    }
  }

  // The 'text' mode has been removed so we need to update any panels still using it to markdown
  const modes = [TextMode.Code, TextMode.HTML, TextMode.Markdown];
  if (!modes.find((f) => f === options.mode)) {
    options = { ...options, mode: TextMode.Markdown };
  }

  return options;
};
