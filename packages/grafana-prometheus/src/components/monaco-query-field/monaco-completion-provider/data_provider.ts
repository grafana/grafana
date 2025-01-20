import { HistoryItem } from '@grafana/data';
import type { Monaco } from '@grafana/ui'; // used in TSDoc `@link` below

import PromQlLanguageProvider from '../../../language_provider';
import { PromQuery } from '../../../types';
import { isValidLegacyName } from '../../../utf8_support';

export const CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT = 'codeModeSuggestionsIncomplete';

export type SuggestionsIncompleteEvent = CustomEvent<{
  limit: number;
  datasourceUid: string;
}>;

export function isSuggestionsIncompleteEvent(e: Event): e is SuggestionsIncompleteEvent {
  return (
    e.type === CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT &&
    'detail' in e &&
    typeof e.detail === 'object' &&
    e.detail !== null &&
    'limit' in e.detail &&
    'datasourceUid' in e.detail
  );
}

interface Metric {
  name: string;
  help: string;
  type: string;
  isUtf8?: boolean;
}

export interface DataProviderParams {
  languageProvider: PromQlLanguageProvider;
  historyProvider: Array<HistoryItem<PromQuery>>;
}

export class DataProvider {
  readonly languageProvider: PromQlLanguageProvider;
  readonly historyProvider: Array<HistoryItem<PromQuery>>;
  readonly getSeriesLabels: typeof this.languageProvider.getSeriesLabels;
  readonly getSeriesValues: typeof this.languageProvider.getSeriesValues;
  readonly getAllLabelNames: typeof this.languageProvider.getLabelKeys;
  readonly getLabelValues: typeof this.languageProvider.getLabelValues;
  readonly metricNamesSuggestionLimit: number;
  /**
   * The text that's been typed so far within the current {@link Monaco.Range | Range}.
   *
   * @remarks
   * This is useful with fuzzy searching items to provide as Monaco autocomplete suggestions.
   */
  private inputInRange: string;
  private suggestionsIncomplete: boolean;

  constructor(params: DataProviderParams) {
    this.languageProvider = params.languageProvider;
    this.historyProvider = params.historyProvider;
    this.inputInRange = '';
    this.metricNamesSuggestionLimit = this.languageProvider.datasource.metricNamesAutocompleteSuggestionLimit;
    this.suggestionsIncomplete = false;
    this.getSeriesLabels = this.languageProvider.getSeriesLabels.bind(this.languageProvider);
    this.getSeriesValues = this.languageProvider.getSeriesValues.bind(this.languageProvider);
    this.getAllLabelNames = this.languageProvider.getLabelKeys.bind(this.languageProvider);
    this.getLabelValues = this.languageProvider.getLabelValues.bind(this.languageProvider);
  }

  getHistory(): string[] {
    return this.historyProvider.map((h) => h.query.expr).filter(Boolean);
  }

  getAllMetricNames(): string[] {
    return this.languageProvider.metrics;
  }

  metricNamesToMetrics(metricNames: string[]): Metric[] {
    const { metricsMetadata } = this.languageProvider;
    const result: Metric[] = metricNames.map((m) => {
      const metaItem = metricsMetadata?.[m];
      return {
        name: m,
        help: metaItem?.help ?? '',
        type: metaItem?.type ?? '',
        isUtf8: !isValidLegacyName(m),
      };
    });

    return result;
  }

  private enableAutocompleteSuggestionsUpdate(): void {
    this.suggestionsIncomplete = true;
    dispatchEvent(
      new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
        detail: { limit: this.metricNamesSuggestionLimit, datasourceUid: this.languageProvider.datasource.uid },
      })
    );
  }

  private setInputInRange(textInput: string): void {
    this.inputInRange = textInput;
  }

  get monacoSettings() {
    return {
      /**
       * Enable autocomplete suggestions update on every input change.
       *
       * @remarks
       * If fuzzy search is used in `getCompletions` to trim down results to improve performance,
       * we need to instruct Monaco to update the completions on every input change, so that the
       * completions reflect the current input.
       */
      enableAutocompleteSuggestionsUpdate: this.enableAutocompleteSuggestionsUpdate.bind(this),
      inputInRange: this.inputInRange,
      setInputInRange: this.setInputInRange.bind(this),
      suggestionsIncomplete: this.suggestionsIncomplete,
    };
  }
}
