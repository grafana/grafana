import { HistoryItem, TimeRange } from '@grafana/data';

import { DEFAULT_COMPLETION_LIMIT, METRIC_LABEL } from '../../../constants';
import { type PrometheusLanguageProviderInterface } from '../../../language_provider';
import { removeQuotesIfExist } from '../../../language_utils';
import { PromQuery } from '../../../types';
import { escapeForUtf8Support, isValidLegacyName } from '../../../utf8_support';

export const CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT = 'codeModeSuggestionsIncomplete';

type SuggestionsIncompleteEvent = CustomEvent<{
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
  languageProvider: PrometheusLanguageProviderInterface;
  historyProvider: Array<HistoryItem<PromQuery>>;
}

export class DataProvider {
  readonly languageProvider: PrometheusLanguageProviderInterface;
  readonly historyProvider: Array<HistoryItem<PromQuery>>;

  readonly metricNamesSuggestionLimit: number = DEFAULT_COMPLETION_LIMIT;
  readonly queryLabelKeys: typeof this.languageProvider.queryLabelKeys;
  readonly queryLabelValues: typeof this.languageProvider.queryLabelValues;
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
    this.suggestionsIncomplete = false;

    this.queryLabelKeys = this.languageProvider.queryLabelKeys.bind(this.languageProvider);
    this.queryLabelValues = this.languageProvider.queryLabelValues.bind(this.languageProvider);
  }

  /**
   * Queries metric names with optional filtering.
   * Safely constructs regex patterns and handles errors.
   */
  queryMetricNames = async (timeRange: TimeRange, searchTerm: string | undefined): Promise<string[]> => {
    try {
      let match: string | undefined;
      if (searchTerm) {
        const escapedWord = escapeForUtf8Support(removeQuotesIfExist(searchTerm));
        match = `{__name__=~".*${escapedWord}.*"}`;
      }

      const result = await this.languageProvider.queryLabelValues(
        timeRange,
        METRIC_LABEL,
        match,
        DEFAULT_COMPLETION_LIMIT
      );

      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.warn('Failed to query metric names:', error);
      return [];
    }
  };

  getHistory(): string[] {
    return this.historyProvider.map((h) => h.query.expr).filter(Boolean);
  }

  getAllMetricNames(): string[] {
    return this.languageProvider.retrieveMetrics();
  }

  metricNamesToMetrics(metricNames: string[]): Metric[] {
    const metricsMetadata = this.languageProvider.retrieveMetricsMetadata();
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
