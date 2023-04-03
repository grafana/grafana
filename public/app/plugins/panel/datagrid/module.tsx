import { PanelPlugin } from '@grafana/data';

import { DataGridPanel } from './DataGridPanel';
import { PanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions>(DataGridPanel).setPanelOptions((builder) => {
  return builder.addBooleanSwitch({
    path: 'useBlankSnapshot',
    name: 'Use blank snapshot',
    defaultValue: false,
  });
});
