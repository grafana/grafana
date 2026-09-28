import { type CompletionSource } from '@codemirror/autocomplete';

import { CODE_MIRROR_LANGUAGES } from './languages';
import { type CodeMirrorEditorLanguage } from './types';

const languages = Object.keys(CODE_MIRROR_LANGUAGES) as CodeMirrorEditorLanguage[];

jest.mock('@codemirror/lang-sql', () => {
  const actual = jest.requireActual('@codemirror/lang-sql');
  return {
    ...actual,
    sql: jest.fn((config) => actual.sql(config)),
  };
});

// The language loader memoizes extensions in a module-level cache, so each test
// runs with an isolated module registry to exercise loading fresh.
describe('loadLanguageExtension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no language is provided', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      await expect(loadLanguageExtension(undefined)).resolves.toBeNull();
    });
  });

  it('defaults the SQL dialect to StandardSQL', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql');

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: true });
    });
  });

  it('uses the StandardSQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: true });
    });
  });

  it('uses the MySQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, MySQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'mySql' });

      expect(sql).toHaveBeenCalledWith({ dialect: MySQL, upperCaseKeywords: true });
    });
  });

  it('adds indentation-based folding to SQL', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { foldable } = await import('@codemirror/language');
      const { EditorState } = await import('@codemirror/state');
      const extension = await loadLanguageExtension('sql');
      const state = EditorState.create({
        doc: 'FROM\n  table_a\nWHERE one > 0',
        extensions: extension ? [extension] : [],
      });
      const fromLine = state.doc.line(1);

      expect(foldable(state, fromLine.from, fromLine.to)).toEqual({ from: 4, to: 14 });
    });
  });

  it('loads and memoizes each SQL dialect independently', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');

      const standard = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });
      const mySql = await loadLanguageExtension('sql', { sqlDialect: 'mySql' });
      const standardAgain = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(standard).not.toBe(mySql);
      expect(standardAgain).toBe(standard);
    });
  });

  it.each(languages)('loads and memoizes the %s extension', async (languageId) => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { Language, language } = await import('@codemirror/language');
      const { EditorState } = await import('@codemirror/state');

      const extension = await loadLanguageExtension(languageId);
      const again = await loadLanguageExtension(languageId);
      const state = EditorState.create({
        extensions: extension ?? [],
      });

      expect(state.facet(language)).toBeInstanceOf(Language);
      expect(again).toBe(extension);
    });
  });

  it('configures the typescript loader for TypeScript syntax', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { typescriptLanguage } = await import('@codemirror/lang-javascript');

      const extension = await loadLanguageExtension('typescript');

      expect(extension).toHaveProperty('language', typescriptLanguage);
    });
  });

  it('loads and memoizes HTML extensions with and without on* event handler completions independently', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');

      const defaultHtml = await loadLanguageExtension('html');
      const filtered = await loadLanguageExtension('html', { htmlAutocompleteEventHandlers: false });
      const defaultAgain = await loadLanguageExtension('html', { htmlAutocompleteEventHandlers: true });

      expect(defaultHtml).not.toBe(filtered);
      expect(defaultAgain).toBe(defaultHtml);
    });
  });

  it('defaults htmlAutocompleteEventHandlers to true and includes on* event handlers in HTML completions', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { CompletionContext } = await import('@codemirror/autocomplete');
      const { EditorState } = await import('@codemirror/state');

      const extension = await loadLanguageExtension('html');
      const state = EditorState.create({
        doc: '<div on',
        extensions: extension ? [extension] : [],
      });
      const context = new CompletionContext(state, 7, true);
      const results = await Promise.all(
        state.languageDataAt<CompletionSource>('autocomplete', 7).map((source) => source(context))
      );
      const completions = results.flatMap((result) => (result && 'options' in result ? result.options : []));

      expect(completions.some((option) => option.label === 'onclick')).toBe(true);
      expect(completions.some((option) => option.label.startsWith('on'))).toBe(true);
    });
  });

  it('drops on* event handler attributes when htmlAutocompleteEventHandlers is false', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { CompletionContext } = await import('@codemirror/autocomplete');
      const { EditorState } = await import('@codemirror/state');

      const extension = await loadLanguageExtension('html', { htmlAutocompleteEventHandlers: false });
      const state = EditorState.create({
        doc: '<div on',
        extensions: extension ? [extension] : [],
      });
      const context = new CompletionContext(state, 7, true);
      const results = await Promise.all(
        state.languageDataAt<CompletionSource>('autocomplete', 7).map((source) => source(context))
      );
      const completions = results.flatMap((result) => (result && 'options' in result ? result.options : []));

      expect(completions.some((option) => option.label.startsWith('on'))).toBe(false);
      expect(completions.some((option) => option.label === 'onclick')).toBe(false);
      expect(completions.some((option) => option.label === 'id')).toBe(true);
      expect(completions.some((option) => option.label === 'class')).toBe(true);
    });
  });

  it('preserves HTML tag completions when htmlAutocompleteEventHandlers is false', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { CompletionContext } = await import('@codemirror/autocomplete');
      const { EditorState } = await import('@codemirror/state');

      const extension = await loadLanguageExtension('html', { htmlAutocompleteEventHandlers: false });
      const state = EditorState.create({
        doc: '<d',
        extensions: extension ? [extension] : [],
      });
      const context = new CompletionContext(state, 2, true);
      const results = await Promise.all(
        state.languageDataAt<CompletionSource>('autocomplete', 2).map((source) => source(context))
      );
      const completions = results.flatMap((result) => (result && 'options' in result ? result.options : []));

      expect(completions.some((option) => option.label === 'div')).toBe(true);
    });
  });

  it('preserves valid attribute value completions such as "on" when htmlAutocompleteEventHandlers is false', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { CompletionContext } = await import('@codemirror/autocomplete');
      const { EditorState } = await import('@codemirror/state');

      const extension = await loadLanguageExtension('html', { htmlAutocompleteEventHandlers: false });
      const state = EditorState.create({
        doc: '<input autocomplete="o',
        extensions: extension ? [extension] : [],
      });
      const context = new CompletionContext(state, 22, true);
      const results = await Promise.all(
        state.languageDataAt<CompletionSource>('autocomplete', 22).map((source) => source(context))
      );
      const completions = results.flatMap((result) => (result && 'options' in result ? result.options : []));

      expect(completions.some((option) => option.label === 'on')).toBe(true);
      expect(completions.some((option) => option.label === 'off')).toBe(true);
    });
  });
});
