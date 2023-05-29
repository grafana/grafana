import { PanelPlugin } from '@grafana/data';

import { DebugPanel } from './DebugPanel';
import { StateViewEditor } from './StateView';
import { DebugMode, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(DebugPanel).useFieldConfig().setPanelOptions((builder) => {
  builder
    .addSelect({
      path: 'mode',
      name: 'Mode',
      defaultValue: DebugMode.Render,
      settings: {
        options: [
          { label: 'Render', value: DebugMode.Render },
          { label: 'Events', value: DebugMode.Events },
          { label: 'Cursor', value: DebugMode.Cursor },
          { label: 'Cursor', value: DebugMode.Cursor },
          { label: 'Share state', value: DebugMode.State },
          { label: 'Throw error', value: DebugMode.ThrowError },
        ],
      },
    })
    .addCustomEditor({
      id: 'stateView',
      path: 'stateView',
      name: 'State view',
      defaultValue: '',
      showIf: ({ mode }) => mode === DebugMode.State,
      editor: StateViewEditor,
    })
    .addBooleanSwitch({
      path: 'counters.render',
      name: 'Render Count',
      defaultValue: true,
      showIf: ({ mode }) => mode === DebugMode.Render,
    })
    .addBooleanSwitch({
      path: 'counters.dataChanged',
      name: 'Data Changed Count',
      defaultValue: true,
      showIf: ({ mode }) => mode === DebugMode.Render,
    })
    .addBooleanSwitch({
      path: 'counters.schemaChanged',
      name: 'Schema Changed Count',
      defaultValue: true,
      showIf: ({ mode }) => mode === DebugMode.Render,
    })
    .addDashboardPicker({
      path: 'dashboardUID',
      name: 'Dashboard',
      settings: {
        placeholder: 'Select dashboard',
        isClearable: true,
      },
    });
});
