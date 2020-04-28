import { sharedSingleStatPanelChangedHandler, BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { PanelModel } from '@grafana/data';
import { StatPanelOptions } from './types';

// This is called when the panel changes from another panel
export const statPanelChangedHandler = (
  panel: PanelModel<Partial<StatPanelOptions>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const options = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions) as StatPanelOptions;

  // Changing from angular singlestat
  if (prevPluginId === 'singlestat' && prevOptions.angular) {
    const oldOptions = prevOptions.angular;

    options.graphMode =
      oldOptions.sparkline && oldOptions.sparkline.show === true ? BigValueGraphMode.Area : BigValueGraphMode.None;

    if (oldOptions.colorBackground) {
      options.colorMode = BigValueColorMode.Background;
    } else {
      options.colorMode = BigValueColorMode.Value;
    }
  }

  return options;
};
