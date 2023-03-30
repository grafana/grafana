import { PanelPlugin } from '@grafana/data';

import { DataGridPanel } from './DataGridPanel';
import { PanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions>(DataGridPanel);
// .setPanelOptions((builder) => {
//   return builder.addBooleanSwitch({
//     path: 'usePanelData',
//     name: 'Use saved panel data',
//     defaultValue: false,
//   });
// });
