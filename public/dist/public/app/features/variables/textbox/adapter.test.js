import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { textboxBuilder } from '../shared/testing/builders';
import { VariableHide } from '../types';
variableAdapters.setInit(function () { return [createTextBoxVariableAdapter()]; });
describe('createTextBoxVariableAdapter', function () {
    describe('getSaveModel', function () {
        describe('when called and query differs from the original query and not saving current as default', function () {
            it('then the model should be correct', function () {
                var text = textboxBuilder()
                    .withId('text')
                    .withName('text')
                    .withQuery('query')
                    .withOriginalQuery('original')
                    .withCurrent('query')
                    .withOptions('query')
                    .build();
                var adapter = variableAdapters.get('textbox');
                var result = adapter.getSaveModel(text, false);
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
        describe('when called and query differs from the original query and saving current as default', function () {
            it('then the model should be correct', function () {
                var text = textboxBuilder()
                    .withId('text')
                    .withName('text')
                    .withQuery('query')
                    .withOriginalQuery('original')
                    .withCurrent('query')
                    .withOptions('query')
                    .build();
                var adapter = variableAdapters.get('textbox');
                var result = adapter.getSaveModel(text, true);
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
    describe('beforeAdding', function () {
        describe('when called', function () {
            it('then originalQuery should be same added', function () {
                var model = { name: 'text', query: 'a query' };
                var adapter = variableAdapters.get('textbox');
                var result = adapter.beforeAdding(model);
                expect(result).toEqual({ name: 'text', query: 'a query', originalQuery: 'a query' });
            });
        });
    });
});
//# sourceMappingURL=adapter.test.js.map