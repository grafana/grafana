import { LanguageProvider, SelectableValue } from '@grafana/data';

import { TempoDatasource } from './datasource';
import { Tags } from './types';

export default class TempoLanguageProvider extends LanguageProvider {
  datasource: TempoDatasource;
  tags?: Tags;
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
    let v1Resp, v2Resp;
    try {
      v2Resp = await this.request('/api/v2/search/tags', []);
    } catch (error) {
      v1Resp = await this.request('/api/search/tags', []);
    }
    this.tags = {
      v1: v2Resp ? undefined : v1Resp.tagNames,
      v2: v2Resp && v2Resp.scopes ? v2Resp.scopes : undefined,
    };
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

  async getOptionsV2(tag: string): Promise<Array<SelectableValue<string>>> {
    const response = await this.request(`/api/v2/search/tag/${tag}/values`);
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
