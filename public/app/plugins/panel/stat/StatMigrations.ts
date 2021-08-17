import { sharedSingleStatPanelChangedHandler, BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { FieldColorModeId, FieldConfigSource, PanelModel } from '@grafana/data';
import { StatPanelOptions } from './types';
import { BigValueTextMode } from '@grafana/ui/src/components/BigValue/BigValue';

// This is called when the panel changes from another panel
export const statPanelChangedHandler = (
  panel: PanelModel<Partial<StatPanelOptions>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const options = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions) as StatPanelOptions;

  // Changing from angular singlestat
  if (prevOptions.angular && (prevPluginId === 'singlestat' || prevPluginId === 'grafana-singlestat-panel')) {
    const oldOptions = prevOptions.angular;

    options.graphMode = BigValueGraphMode.None;
    if (oldOptions.sparkline && oldOptions.sparkline.show) {
      options.graphMode = BigValueGraphMode.Area;
    }

    if (oldOptions.colorBackground) {
      options.colorMode = BigValueColorMode.Background;
    } else if (oldOptions.colorValue) {
      options.colorMode = BigValueColorMode.Value;
    } else {
      options.colorMode = BigValueColorMode.None;
      if (oldOptions.sparkline?.lineColor && options.graphMode === BigValueGraphMode.Area) {
        const cfg: FieldConfigSource = panel.fieldConfig ?? {};
        cfg.defaults.color = {
          mode: FieldColorModeId.Fixed,
          fixedColor: oldOptions.sparkline.lineColor,
        };
        panel.fieldConfig = cfg;
      }
    }

    if (oldOptions.valueName === 'name') {
      options.textMode = BigValueTextMode.Name;
    }
  }

  return options;
};
