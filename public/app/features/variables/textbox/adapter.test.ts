import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { textboxBuilder } from '../shared/testing/builders';
import { VariableHide } from '../types';

variableAdapters.setInit(() => [createTextBoxVariableAdapter()]);

describe('createTextBoxVariableAdapter', () => {
  describe('getSaveModel', () => {
    describe('when called and query differs from the original query and not saving current as default', () => {
      it('then the model should be correct', () => {
        const text = textboxBuilder()
          .withId('text')
          .withName('text')
          .withQuery('query')
          .withOriginalQuery('original')
          .withCurrent('query')
          .withOptions('query')
          .build();

        const adapter = variableAdapters.get('textbox');

        const result = adapter.getSaveModel(text, false);

        expect(result).toEqual({
          name: 'text',
          query: 'original',
          current: { selected: false, text: 'original', value: 'original' },
          options: [{ selected: false, text: 'original', value: 'original' }],
          type: 'textbox',
          label: null,
          hide: VariableHide.dontHide,
          skipUrlSync: false,
          error: null,
          description: null,
        });
      });
    });

    describe('when called and query differs from the original query and saving current as default', () => {
      it('then the model should be correct', () => {
        const text = textboxBuilder()
          .withId('text')
          .withName('text')
          .withQuery('query')
          .withOriginalQuery('original')
          .withCurrent('query')
          .withOptions('query')
          .build();

        const adapter = variableAdapters.get('textbox');

        const result = adapter.getSaveModel(text, true);

        expect(result).toEqual({
          name: 'text',
          query: 'query',
          current: { selected: true, text: 'query', value: 'query' },
          options: [{ selected: false, text: 'query', value: 'query' }],
          type: 'textbox',
          label: null,
          hide: VariableHide.dontHide,
          skipUrlSync: false,
          error: null,
          description: null,
        });
      });
    });
  });

  describe('beforeAdding', () => {
    describe('when called', () => {
      it('then originalQuery should be same added', () => {
        const model = { name: 'text', query: 'a query' };

        const adapter = variableAdapters.get('textbox');

        const result = adapter.beforeAdding!(model);

        expect(result).toEqual({ name: 'text', query: 'a query', originalQuery: 'a query' });
      });
    });
  });
});
