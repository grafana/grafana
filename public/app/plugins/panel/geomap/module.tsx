import { PanelPlugin } from '@grafana/data';
import { GeomapPanel } from './GeomapPanel';
import { GeomapPanelOptions } from './types';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .useFieldConfig()
  .setPanelOptions((builder) => {
    builder.addBooleanSwitch({
      path: 'showZoomControl',
      name: 'Show zoom control',
      defaultValue: true,
    });
  });
