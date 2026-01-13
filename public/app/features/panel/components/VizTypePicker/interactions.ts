import { reportInteraction } from '@grafana/runtime';

export const PANEL_STATES = {
  UNCONFIGURED_PANEL: 'unconfigured_panel',
  NEW_PANEL: 'new_panel',
  EXISTING_PANEL: 'existing_panel',
} as const;

export type PanelState = (typeof PANEL_STATES)[keyof typeof PANEL_STATES];

export const VizSuggestionsInteractions = {
  suggestionPreviewed: (properties: {
    pluginId: string;
    suggestionName: string;
    panelState: PanelState;
    isAutoSelected?: boolean;
  }) => {
    reportVizSuggestionsInteraction('suggestion_previewed', properties);
  },

  suggestionAccepted: (properties: { pluginId: string; suggestionName: string; panelState: PanelState }) => {
    reportVizSuggestionsInteraction('suggestion_accepted', properties);
  },
};

const reportVizSuggestionsInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_viz_suggestions_${name}`, properties);
};
