import { PanelPlugin } from '@grafana/data';
import { StoreState } from 'app/types/store';

import { getPanelPluginNotFound } from '../../panel/components/PanelPluginError';

export const getPanelPluginWithFallback =
  (panelType: string) =>
  (state: StoreState): PanelPlugin => {
    const plugin = state.plugins.panels[panelType];
    return plugin || getPanelPluginNotFound(`Panel plugin not found (${panelType})`, true);
  };
