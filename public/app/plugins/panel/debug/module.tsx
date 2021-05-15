import { PanelPlugin } from '@grafana/data';
import { DebugPanel } from './DebugPanel';
import { DebugPanelOptions } from './types';

export const plugin = new PanelPlugin<DebugPanelOptions>(DebugPanel).useFieldConfig().setPanelOptions((builder) => {
  builder
    .addBooleanSwitch({
      path: 'counters.render',
      name: 'Render Count',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'counters.dataChanged',
      name: 'Data Changed Count',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'counters.schemaChanged',
      name: 'Schema Changed Count',
      defaultValue: true,
    });
});
