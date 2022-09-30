import { PanelModel } from '@grafana/data';

import { PanelOptions } from './models.gen';

export const canvasMigrationHandler = (panel: PanelModel): Partial<PanelOptions> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // TODO: how to set plugin version?? want this to run for everything < v9.2.0
  console.log('this is happening', { pluginVersion });

  // Rename text-box to rectangle
  //   if (pluginVersion.startsWith('9.3')) {
  const root = panel.options?.root;
  if (root?.elements) {
    for (const element of root.elements) {
      if (element.type === 'text-box') {
        element.type = 'rectangle';
      }
    }
  }
  //   }

  return panel.options;
};
