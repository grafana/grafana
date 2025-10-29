import { defaultsDeep } from 'lodash';

import { GraphFieldConfig } from '@grafana/schema';

import { PanelModel } from '../types/dashboard';
import { PanelData } from '../types/panel';

import { getPanelDataSummary } from './getPanelDataSummary';
import { PanelDataSummary, VisualizationSuggestion, VisualizationSuggestionScore } from './types';

/**
 * used to build up a list of suggestions
 */
export class VisualizationSuggestionsBuilder {
  /** Current data */
  data?: PanelData;
  /** Current panel & options */
  panel?: PanelModel;
  /** Summary stats for current data */
  dataSummary: PanelDataSummary;

  private list: VisualizationSuggestion[] = [];

  constructor(data?: PanelData, panel?: PanelModel) {
    this.data = data;
    this.panel = panel;
    this.dataSummary = this.computeDataSummary();
  }

  getListAppender<TOptions extends {}, TFieldConfig extends {} = GraphFieldConfig>(
    defaults: VisualizationSuggestion<TOptions, TFieldConfig>
  ) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
  }

  private computeDataSummary(): PanelDataSummary {
    return getPanelDataSummary(this.data?.series ?? []);
  }

  getList() {
    return this.list;
  }

  getSortedList() {
    return this.list.sort((a, b) => {
      if (this.dataSummary.preferredVisualisationType) {
        if (a.pluginId === this.dataSummary.preferredVisualisationType) {
          return -1;
        }
        if (b.pluginId === this.dataSummary.preferredVisualisationType) {
          return 1;
        }
      }
      return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
    });
  }
}

/**
 * Helps with typings and defaults
 * @alpha
 */
export class VisualizationSuggestionsListAppender<TOptions extends {}, TFieldConfig extends {} = GraphFieldConfig> {
  constructor(
    private list: VisualizationSuggestion[],
    private defaults: VisualizationSuggestion<TOptions, TFieldConfig>
  ) {}

  append(overrides: Partial<VisualizationSuggestion<TOptions, TFieldConfig>>) {
    this.list.push(defaultsDeep(overrides, this.defaults));
  }
}
