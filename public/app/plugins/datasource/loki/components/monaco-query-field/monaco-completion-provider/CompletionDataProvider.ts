import { chain } from 'lodash';

import { HistoryItem, TimeRange } from '@grafana/data';

import LanguageProvider from '../../../LanguageProvider';
import { escapeLabelValueInExactSelector } from '../../../languageUtils';
import { ParserAndLabelKeysResult, LokiQuery } from '../../../types';

import { Label } from './situation';

interface HistoryRef {
  current: Array<HistoryItem<LokiQuery>>;
}

export class CompletionDataProvider {
  constructor(
    private languageProvider: LanguageProvider,
    private historyRef: HistoryRef = { current: [] },
    private timeRange: TimeRange | undefined
  ) {
    this.queryToLabelKeysCache = new Map();
  }
  private queryToLabelKeysCache: Map<string, ParserAndLabelKeysResult>;

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
      return await this.languageProvider.fetchLabelValues(labelName, { timeRange: this.timeRange });
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
  async getParserAndLabelKeys(logQuery: string): Promise<ParserAndLabelKeysResult> {
    const EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE = 2;
    const cachedLabelKeys = this.queryToLabelKeysCache.has(logQuery) ? this.queryToLabelKeysCache.get(logQuery) : null;
    if (cachedLabelKeys) {
      // cache hit! Serve stale result from cache
      return cachedLabelKeys;
    } else {
      // If cache is larger than max size, delete the first (oldest) index
      if (this.queryToLabelKeysCache.size >= EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE) {
        // Make room in the cache for the fresh result by deleting the "first" index
        const keys = this.queryToLabelKeysCache.keys();
        const firstKey = keys.next().value;
        this.queryToLabelKeysCache.delete(firstKey);
      }
      // Fetch a fresh result from the backend
      const labelKeys = await this.languageProvider.getParserAndLabelKeys(logQuery, { timeRange: this.timeRange });
      // Add the result to the cache
      this.queryToLabelKeysCache.set(logQuery, labelKeys);
      return labelKeys;
    }
  }

  async getSeriesLabels(labels: Label[]) {
    return await this.languageProvider
      .fetchSeriesLabels(this.buildSelector(labels), { timeRange: this.timeRange })
      .then((data) => data ?? {});
  }
}
