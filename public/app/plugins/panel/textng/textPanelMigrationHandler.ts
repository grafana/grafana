import { type PanelModel } from '@grafana/data';

import { TextMode, type Options } from '../../schemas/textng/panelcfg.gen';

type LegacyTextPanel = PanelModel<Options> & { content?: string; mode?: TextMode };

export const textPanelMigrationHandler = (panel: LegacyTextPanel): Partial<Options> => {
  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  let options: Partial<Options> = panel.options ?? {};

  // Migrates old Angular based text panel props to new props
  if (panel.hasOwnProperty('content') && panel.hasOwnProperty('mode')) {
    const content = panel.content;
    const mode = panel.mode;

    delete panel.content;
    delete panel.mode;

    if (previousVersion < 7.1) {
      // Always adopt the legacy content once the top-level props are deleted,
      // otherwise the user's content would be silently lost.
      options = { content: content ?? '', mode: mode ?? TextMode.Markdown };
    }
  }

  // The 'text' mode has been removed so we need to update any panels still using it to markdown
  const modes = [TextMode.Code, TextMode.HTML, TextMode.Markdown];
  if (!modes.find((f) => f === options.mode)) {
    options = { ...options, mode: TextMode.Markdown };
  }

  return options;
};
