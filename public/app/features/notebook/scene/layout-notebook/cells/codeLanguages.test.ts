import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

import { codeLanguageLabel, getCodeLanguageOptions, PLAIN_TEXT_LANGUAGE, toCodeMirrorLanguage } from './codeLanguages';

// Every language the editor supports. Adding one to CodeMirrorEditorLanguage without adding it here
// leaves this list short, so the exhaustiveness assertion below is what actually keeps them in step.
const SUPPORTED: CodeMirrorEditorLanguage[] = ['go', 'html', 'json', 'markdown', 'sql', 'typescript', 'xml', 'yaml'];

describe('toCodeMirrorLanguage', () => {
  it.each(SUPPORTED)('passes %s through to the editor', (language) => {
    expect(toCodeMirrorLanguage(language)).toBe(language);
  });

  it('gives up on a language the editor cannot highlight', () => {
    // promql has no CodeMirror package in this repo. It renders unhighlighted rather than failing.
    expect(toCodeMirrorLanguage('promql')).toBeUndefined();
    expect(toCodeMirrorLanguage('python')).toBeUndefined();
  });

  // `language` is free-form, so an Object.prototype key can reach the lookup. Answering it with `in`
  // would narrow these to real languages, and the loader has no branch for them.
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])('does not treat %s as a language', (key) => {
    expect(toCodeMirrorLanguage(key)).toBeUndefined();
  });

  it('treats the empty language as no highlighting', () => {
    expect(toCodeMirrorLanguage(PLAIN_TEXT_LANGUAGE)).toBeUndefined();
  });
});

describe('codeLanguageLabel', () => {
  it('uses a display name for a supported language', () => {
    expect(codeLanguageLabel('sql')).toBe('SQL');
    expect(codeLanguageLabel('typescript')).toBe('TypeScript');
  });

  it('names the empty language', () => {
    expect(codeLanguageLabel(PLAIN_TEXT_LANGUAGE)).toBe('Plain text');
  });

  it('shows an unrecognised language as it was stored', () => {
    expect(codeLanguageLabel('promql')).toBe('promql');
  });

  // Without an own-key check this returns Object's constructor, and React throws on a function child.
  it('does not return a prototype member as a label', () => {
    expect(codeLanguageLabel('constructor')).toBe('constructor');
  });
});

describe('getCodeLanguageOptions', () => {
  it('offers plain text plus every supported language', () => {
    const values = getCodeLanguageOptions('sql').map((option) => option.value);

    expect(values).toEqual([PLAIN_TEXT_LANGUAGE, ...SUPPORTED]);
  });

  it('does not duplicate the current language when it is already supported', () => {
    const values = getCodeLanguageOptions('json').map((option) => option.value);

    expect(values.filter((value) => value === 'json')).toHaveLength(1);
  });

  it('adds an unrecognised current language so selecting from the list cannot silently drop it', () => {
    const options = getCodeLanguageOptions('promql');

    expect(options[0]).toEqual({ value: 'promql', label: 'promql' });
    expect(options).toHaveLength(SUPPORTED.length + 2);
  });

  it('does not add an extra entry for plain text', () => {
    const values = getCodeLanguageOptions(PLAIN_TEXT_LANGUAGE).map((option) => option.value);

    expect(values).toEqual([PLAIN_TEXT_LANGUAGE, ...SUPPORTED]);
  });
});
