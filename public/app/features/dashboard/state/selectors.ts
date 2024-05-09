import { PanelPlugin } from '@grafana/data';
// @todo: replace barrel import path
import { StoreState } from 'app/types/index';

import { getPanelPluginNotFound } from '../../panel/components/PanelPluginError';

export const getPanelPluginWithFallback =
  (panelType: string) =>
  (state: StoreState): PanelPlugin => {
    const plugin = state.plugins.panels[panelType];
    return plugin || getPanelPluginNotFound(`Panel plugin not found (${panelType})`, true);
  };
