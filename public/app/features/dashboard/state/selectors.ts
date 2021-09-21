import { DashboardState, PanelState, StoreState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { getPanelPluginNotFound } from '../dashgrid/PanelPluginError';

export function getPanelStateById(state: DashboardState, panelId: number): PanelState {
  if (!panelId) {
    return {} as PanelState;
  }

  return state.panels[panelId] ?? ({} as PanelState);
}

export const getPanelPluginWithFallback = (panelType: string) => (state: StoreState): PanelPlugin => {
  const plugin = state.plugins.panels[panelType];
  return plugin || getPanelPluginNotFound(`Panel plugin not found (${panelType})`, true);
};
