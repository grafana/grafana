import { Value } from 'slate';

import { LanguageProvider, SelectableValue } from '@grafana/data';
import { CompletionItemGroup, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

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

  provideCompletionItems = async ({ text, value }: TypeaheadInput): Promise<TypeaheadOutput> => {
    const emptyResult: TypeaheadOutput = { suggestions: [] };

    if (!value) {
      return emptyResult;
    }

    const query = value.endText.getText();
    const isValue = query[query.indexOf(text) - 1] === '=';
    if (isValue || text === '=') {
      return this.getTagValueCompletionItems(value);
    }
    return this.getTagsCompletionItems();
  };

  getTagsCompletionItems = (): TypeaheadOutput => {
    const { tags } = this;
    const suggestions: CompletionItemGroup[] = [];

    if (tags?.length) {
      suggestions.push({
        label: `Tag`,
        items: tags.map((tag) => ({ label: tag })),
      });
    }

    return { suggestions };
  };

  async getTagValueCompletionItems(value: Value) {
    const tags = value.endText.getText().split(' ');

    let tagName = tags[tags.length - 1] ?? '';
    tagName = tagName.split('=')[0];

    const response = await this.request(`/api/search/tag/${tagName}/values`, []);
    const suggestions: CompletionItemGroup[] = [];

    if (response && response.tagValues) {
      suggestions.push({
        label: `Tag Values`,
        items: response.tagValues.map((tagValue: string) => ({ label: tagValue })),
      });
    }
    return { suggestions };
  }

  async getOptions(tag: string): Promise<Array<SelectableValue<string>>> {
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
}
