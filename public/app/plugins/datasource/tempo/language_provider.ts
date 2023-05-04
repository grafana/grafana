import { LanguageProvider, SelectableValue } from '@grafana/data';

import { TempoDatasource } from './datasource';

export default class TempoLanguageProvider extends LanguageProvider {
  datasource: TempoDatasource;
  tags?: string[];
  constructor(datasource: TempoDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    Object.assign(this, initialValues);
  }

  request = async (url: string, params = {}) => {
    const res = await this.datasource.metadataRequest(url, params);
    return res?.data;
  };

  start = async () => {
    if (!this.startTask) {
      this.startTask = this.fetchTags().then(() => {
        return [];
      });
    }

    return this.startTask;
  };

  async fetchTags() {
    const response = await this.request('/api/search/tags', []);
    this.tags = response.tagNames;
  }

  getTags = () => {
    return this.tags;
  };

  async getOptionsV1(tag: string): Promise<Array<SelectableValue<string>>> {
    const response = await this.request(`/api/search/tag/${tag}/values`);
    let options: Array<SelectableValue<string>> = [];
    if (response && response.tagValues) {
      options = response.tagValues.map((v: string) => ({
        value: v,
        label: v,
      }));
    }
    return options;
  }

  async getOptionsV2(tag: string, query: string): Promise<Array<SelectableValue<string>>> {
    const response = await this.request(`/api/v2/search/tag/${tag}/values`, query ? { q: query } : {});
    let options: Array<SelectableValue<string>> = [];
    if (response && response.tagValues) {
      options = response.tagValues.map((v: { type: string; value: string }) => ({
        type: v.type,
        value: v.value,
        label: v.value,
      }));
    }
    return options;
  }
}
