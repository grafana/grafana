import { chain } from 'lodash';

import { HistoryItem } from '@grafana/data';
import { escapeLabelValueInExactSelector } from 'app/plugins/datasource/prometheus/language_utils';

import LanguageProvider from '../../../LanguageProvider';
import { ExtractedLabelKeys, LokiQuery } from '../../../types';

import { Label } from './situation';

interface HistoryRef {
  current: Array<HistoryItem<LokiQuery>>;
}

export class CompletionDataProvider {
  constructor(
    private languageProvider: LanguageProvider,
    private historyRef: HistoryRef = { current: [] }
  ) {
    this.queryToLabelKeysCache = new Map();
  }
  private queryToLabelKeysCache: Map<string, ExtractedLabelKeys>;

  private buildSelector(labels: Label[]): string {
    const allLabelTexts = labels.map(
      (label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`
    );

    return `{${allLabelTexts.join(',')}}`;
  }

  getHistory() {
    return chain(this.historyRef.current)
      .map((history: HistoryItem<LokiQuery>) => history.query.expr)
      .filter()
      .uniq()
      .value();
  }

  async getLabelNames(otherLabels: Label[] = []) {
    if (otherLabels.length === 0) {
      // if there is no filtering, we have to use a special endpoint
      return this.languageProvider.getLabelKeys();
    }
    const data = await this.getSeriesLabels(otherLabels);
    const possibleLabelNames = Object.keys(data); // all names from datasource
    const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
    return possibleLabelNames.filter((label) => !usedLabelNames.has(label));
  }

  async getLabelValues(labelName: string, otherLabels: Label[]) {
    if (otherLabels.length === 0) {
      // if there is no filtering, we have to use a special endpoint
      return await this.languageProvider.getLabelValues(labelName);
    }

    const data = await this.getSeriesLabels(otherLabels);
    return data[labelName] ?? [];
  }

  /**
   * Runs a Loki query to extract label keys from the result.
   * The result is cached for the query string.
   *
   * Since various "situations" in the monaco code editor trigger this function, it is prone to being called multiple times for the same query
   * Here is a lightweight and simple cache to avoid calling the backend multiple times for the same query.
   *
   * @param logQuery
   */
  async getParserAndLabelKeys(logQuery: string): Promise<ExtractedLabelKeys> {
    const EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE = 2;
    if (this.queryToLabelKeysCache.has(logQuery)) {
      // Asserting the type here because we know something is in the cache from the use of Map.has() above
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return this.queryToLabelKeysCache.get(logQuery) as ExtractedLabelKeys;
    } else {
      // Save last two results in the cache
      if (this.queryToLabelKeysCache.size >= EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE) {
        // Make room in the cache for the fresh result by deleting the "first" index
        const keys = this.queryToLabelKeysCache.keys();
        const firstKey = keys.next().value;
        this.queryToLabelKeysCache.delete(firstKey);
      }
      const result = await this.languageProvider.getParserAndLabelKeys(logQuery);
      this.queryToLabelKeysCache.set(logQuery, result);
      return result;
    }
  }

  async getSeriesLabels(labels: Label[]) {
    return await this.languageProvider.getSeriesLabels(this.buildSelector(labels)).then((data) => data ?? {});
  }
}
