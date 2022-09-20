import { HistoryItem } from '@grafana/data';

import LanguageProvider from '../../../LanguageProvider';
import { LokiQuery } from '../../../types';

export class CompletionDataProvider {
  constructor(private languageProvider: LanguageProvider, private history: Array<HistoryItem<LokiQuery>> = []) {}

  getHistory() {
    return this.history.map((entry) => entry.query.expr).filter((expr) => expr !== undefined);
  }

  getAllLabelNames() {
    return Promise.resolve(this.languageProvider.getLabelKeys());
  }

  getLabelValues(labelName: string) {
    return this.languageProvider.getLabelValues(labelName);
  }

  getLogInfo(selector: string) {
    return this.languageProvider.getLogInfo(selector);
  }

  getSeriesLabels(selector: string) {
    return this.languageProvider.getSeriesLabels(selector).then((data) => data ?? {});
  }
}
