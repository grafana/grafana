import { HistoryItem } from '@grafana/data';
import { escapeLabelValueInExactSelector } from 'app/plugins/datasource/prometheus/language_utils';

import LanguageProvider from '../../../LanguageProvider';
import { LokiQuery } from '../../../types';

import { Label } from './situation';

export class CompletionDataProvider {
  constructor(private languageProvider: LanguageProvider, private history: Array<HistoryItem<LokiQuery>> = []) {}

  private buildSelector(labels: Label[]): string {
    const allLabelTexts = labels.map(
      (label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`
    );

    return `{${allLabelTexts.join(',')}}`;
  }

  getHistory() {
    return this.history.map((entry) => entry.query.expr).filter((expr) => expr !== undefined);
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

  async getParserAndLabelKeys(labels: Label[]) {
    return await this.languageProvider.getParserAndLabelKeys(this.buildSelector(labels));
  }

  async getSeriesLabels(labels: Label[]) {
    return await this.languageProvider.getSeriesLabels(this.buildSelector(labels)).then((data) => data ?? {});
  }
}
