import { reportInteraction } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { DashboardDiscardedEvent, DashboardSavedEvent } from 'app/types/events';

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

  presetApplied: (properties: { pluginId: string; presetName: string; presetIndex: number }) => {
    reportVizSuggestionsInteraction('preset_applied', properties);
  },

  panelSaved: ({ pluginId, isNewPanel, suggestionName, suggestionIndex }: PanelSuggestionInfo) => {
    reportVizSuggestionsInteraction('panel_saved', { pluginId, isNewPanel, suggestionName, suggestionIndex });
  },
};

const reportVizSuggestionsInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_viz_${name}`, properties);
};

class VizSuggestionsDashboardSaveTracker {
  private _receipts = new Map<string, PanelSuggestionInfo>();

  constructor() {
    appEvents?.subscribe?.(DashboardSavedEvent, this.onDashboardSaved);
    appEvents?.subscribe?.(DashboardDiscardedEvent, this.onDashboardDiscarded);
  }

  record(panelKey: string, info: PanelSuggestionInfo | undefined) {
    if (info) {
      this._receipts.set(panelKey, info);
    } else {
      this._receipts.delete(panelKey);
    }
  }

  private onDashboardSaved = () => {
    for (const info of this._receipts.values()) {
      VizSuggestionsInteractions.panelSaved(info);
    }
    this._receipts.clear();
  };

  private onDashboardDiscarded = () => {
    this._receipts.clear();
  };
}

export const vizSuggestionsTracker = new VizSuggestionsDashboardSaveTracker();
