import { HistoryItem, LanguageProvider, SelectableValue } from '@grafana/data';
import { CompletionItemGroup, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';
import { Value } from 'slate';
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
    await this.fetchTags();
    return [];
  };

  async fetchTags() {
    const response = await this.request('/api/search/tags', []);
    this.tags = response.tagNames;
  }

  provideCompletionItems = async (
    { prefix, text, value, labelKey, wrapperClasses }: TypeaheadInput,
    context: { history: Array<HistoryItem<any>> } = { history: [] }
  ): Promise<TypeaheadOutput> => {
    const emptyResult: TypeaheadOutput = { suggestions: [] };

    if (!value) {
      return emptyResult;
    }
    if (text === '=') {
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
    const tagNames = value.endText.getText().split(' ');
    let tagName = tagNames[0];
    // Get last item if multiple tags
    if (tagNames.length > 1) {
      tagName = tagNames[tagNames.length - 1];
    }
    tagName = tagName.slice(0, -1);
    const response = await this.request(`/api/search/tag/${tagName}/values`, []);
    const suggestions: CompletionItemGroup[] = [];

    if (response && response.tagValues) {
      suggestions.push({
        label: `TagValues`,
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
