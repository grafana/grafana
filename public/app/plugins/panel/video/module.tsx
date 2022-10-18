import { PanelPlugin } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { VideoPanel } from './VideoPanel';
import { PanelOptions, defaultPanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(VideoPanel).setPanelOptions(
  (builder, context) => {
    builder.addBooleanSwitch({
      path: 'autoPlay',
      name: 'Auto play',
      defaultValue: defaultPanelOptions.autoPlay,
    });
  }
);
