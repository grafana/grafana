import { HistoryItem, LanguageProvider } from '@grafana/data';
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

  request = async (url: string, defaultValue: any, params = {}) => {
    try {
      const res = await this.datasource.metadataRequest(url, params);
      return res.data;
    } catch (error) {
      console.error(error);
    }

    return defaultValue;
  };

  start = async () => {
    await this.fetchTags();
    return [];
  };

  async fetchTags() {
    try {
      const response = await this.request('/api/search/tags', []);
      this.tags = response.tagNames;
    } catch (error) {
      console.error(error);
    }
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
}
