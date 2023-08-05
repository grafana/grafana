import { PanelPlugin } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { VideoPanel } from './VideoPanel';
import { Options, defaultOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(VideoPanel).setPanelOptions((builder, context) => {
  builder.addBooleanSwitch({
    path: 'autoPlay',
    name: 'Auto play',
    defaultValue: defaultOptions.autoPlay,
  });
});
