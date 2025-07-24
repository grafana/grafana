import { HistoryItem } from '@grafana/data';
import type { Monaco } from '@grafana/ui'; // used in TSDoc `@link` below

import { SUGGESTIONS_LIMIT } from '../../../constants';
import { type PrometheusLanguageProviderInterface } from '../../../language_provider';
import { PromQuery } from '../../../types';
import { isValidLegacyName } from '../../../utf8_support';

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
  readonly getSeriesLabels: typeof this.languageProvider.queryLabelKeys;
  readonly getSeriesValues: typeof this.languageProvider.queryLabelValues;
  readonly getAllLabelNames: typeof this.languageProvider.retrieveLabelKeys;
  readonly getLabelValues: typeof this.languageProvider.queryLabelValues;
  readonly metricNamesSuggestionLimit: number;
  /**
   * The text that's been typed so far within the current {@link Monaco.Range | Range}.
   *
   * @remarks
   * This is useful with fuzzy searching items to provide as Monaco autocomplete suggestions.
   */
  private inputInRange: string;

  constructor(params: DataProviderParams) {
    this.languageProvider = params.languageProvider;
    this.historyProvider = params.historyProvider;
    this.inputInRange = '';
    this.metricNamesSuggestionLimit = SUGGESTIONS_LIMIT;
    this.getSeriesLabels = this.languageProvider.queryLabelKeys.bind(this.languageProvider);
    this.getSeriesValues = this.languageProvider.queryLabelValues.bind(this.languageProvider);
    this.getAllLabelNames = this.languageProvider.retrieveLabelKeys.bind(this.languageProvider);
    this.getLabelValues = this.languageProvider.queryLabelValues.bind(this.languageProvider);
  }

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

  private setInputInRange(textInput: string): void {
    this.inputInRange = textInput;
  }

  get monacoSettings() {
    return {
      inputInRange: this.inputInRange,
      setInputInRange: this.setInputInRange.bind(this),
    };
  }
}
