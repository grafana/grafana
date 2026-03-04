import { reportInteraction } from '@grafana/runtime';

export const PANEL_STATES = {
  UNCONFIGURED_PANEL: 'unconfigured_panel',
  NEW_PANEL: 'new_panel',
  EXISTING_PANEL: 'existing_panel',
} as const;

export type PanelState = (typeof PANEL_STATES)[keyof typeof PANEL_STATES];

export interface PanelSuggestionInfo {
  pluginId: string;
  isNewPanel: boolean;
  suggestionName: string;
  suggestionIndex: number;
}

export const VizSuggestionsInteractions = {
  suggestionApplied: (properties: {
    pluginId: string;
    suggestionName: string;
    panelState: PanelState;
    suggestionIndex: number;
  }) => {
    reportVizSuggestionsInteraction('suggestion_applied', properties);
  },

  panelSaved: ({ pluginId, isNewPanel, suggestionName, suggestionIndex }: PanelSuggestionInfo) => {
    reportVizSuggestionsInteraction('panel_saved', { pluginId, isNewPanel, suggestionName, suggestionIndex });
  },
};

const reportVizSuggestionsInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_viz_${name}`, properties);
};
