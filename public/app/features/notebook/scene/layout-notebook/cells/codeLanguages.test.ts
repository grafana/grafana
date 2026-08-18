import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

import {
  canonicalLanguage,
  codeLanguageLabel,
  getCodeLanguageOptions,
  normalizeLanguage,
  PLAIN_TEXT_LANGUAGE,
  toCodeMirrorLanguage,
} from './codeLanguages';

// Every language the editor supports. Adding one to CodeMirrorEditorLanguage without adding it here
// leaves this list short, so the exhaustiveness assertion below is what actually keeps them in step.
const HIGHLIGHTED: CodeMirrorEditorLanguage[] = ['go', 'html', 'json', 'markdown', 'sql', 'typescript', 'xml', 'yaml'];

/** Offered by the picker, but deliberately not highlighted. */
const UNHIGHLIGHTED = ['promql', 'logql'];

const OFFERED = [PLAIN_TEXT_LANGUAGE, ...HIGHLIGHTED, ...UNHIGHLIGHTED];

describe('toCodeMirrorLanguage', () => {
  it.each(HIGHLIGHTED)('passes %s through to the editor', (language) => {
    expect(toCodeMirrorLanguage(language)).toBe(language);
  });

  // The picker offers these so a promql cell can be authored, but no CodeMirror highlight tags are
  // wired up for either — offered and highlighted are separate things, which is why the maps are split.
  it.each(UNHIGHLIGHTED)('offers %s without highlighting it', (language) => {
    expect(toCodeMirrorLanguage(language)).toBeUndefined();
  });

  it('gives up on a language nothing knows about', () => {
    expect(toCodeMirrorLanguage('python')).toBeUndefined();
  });

  // The picker writes normalised values, but a hand-written notebook, an import or an
  // assistant-authored spec is only constrained to `z.string()`.
  it.each([
    ['YAML', 'yaml'],
    ['  TypeScript  ', 'typescript'],
    ['yml', 'yaml'],
    ['TS', 'typescript'],
  ])('resolves %s to %s', (stored, expected) => {
    expect(toCodeMirrorLanguage(stored)).toBe(expected);
  });

  // `language` is free-form, so an Object.prototype key can reach the lookup. Answering it with `in`
  // would narrow these to real languages, and the loader has no branch for them. The alias map needs
  // the same guard as the label map.
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])('does not treat %s as a language', (key) => {
    expect(toCodeMirrorLanguage(key)).toBeUndefined();
  });

  it('treats the empty language as no highlighting', () => {
    expect(toCodeMirrorLanguage(PLAIN_TEXT_LANGUAGE)).toBeUndefined();
  });
});

describe('normalizeLanguage', () => {
  it('lowercases and trims, so a typed value matches an offered one', () => {
    expect(normalizeLanguage('  PromQL ')).toBe('promql');
  });
});

describe('canonicalLanguage', () => {
  // The picker's value and its options both go through this. If they disagreed, a cell stored as
  // `yml` would highlight as YAML while rendering an empty control.
  it.each([
    ['yml', 'yaml'],
    ['YAML', 'yaml'],
    ['PromQL', 'promql'],
    ['  Rust  ', 'rust'],
    [PLAIN_TEXT_LANGUAGE, PLAIN_TEXT_LANGUAGE],
  ])('canonicalises %s to %s', (stored, expected) => {
    expect(canonicalLanguage(stored)).toBe(expected);
  });
});

describe('codeLanguageLabel', () => {
  it('uses a display name for a highlighted language', () => {
    expect(codeLanguageLabel('sql')).toBe('SQL');
    expect(codeLanguageLabel('typescript')).toBe('TypeScript');
  });

  it('uses a display name for an offered language that is not highlighted', () => {
    expect(codeLanguageLabel('promql')).toBe('PromQL');
    expect(codeLanguageLabel('logql')).toBe('LogQL');
  });

  it('names the empty language', () => {
    expect(codeLanguageLabel(PLAIN_TEXT_LANGUAGE)).toBe('Plain text');
  });

  it('shows an unrecognised language as it was stored, normalised', () => {
    expect(codeLanguageLabel('Rust')).toBe('rust');
  });

  it('labels an alias with the language it resolves to', () => {
    expect(codeLanguageLabel('yml')).toBe('YAML');
  });

  // Without an own-key check this returns Object's constructor, and React throws on a function child.
  it('does not return a prototype member as a label', () => {
    expect(codeLanguageLabel('constructor')).toBe('constructor');
  });
});

describe('getCodeLanguageOptions', () => {
  it('offers plain text, every highlighted language, and the unhighlighted ones', () => {
    const values = getCodeLanguageOptions('sql').map((option) => option.value);

    expect(values).toEqual(OFFERED);
  });

  it('labels the unhighlighted options so they read like languages, not stored strings', () => {
    const options = getCodeLanguageOptions(PLAIN_TEXT_LANGUAGE);

    expect(options).toEqual(expect.arrayContaining([{ value: 'promql', label: 'PromQL' }]));
  });

  // The guard tests membership of what is offered, not whether the language can be highlighted:
  // promql is offered without highlighting, so the latter would list it twice.
  it.each(['json', 'promql', 'logql', PLAIN_TEXT_LANGUAGE])('does not duplicate %s when already offered', (current) => {
    const values = getCodeLanguageOptions(current).map((option) => option.value);

    expect(values).toEqual(OFFERED);
  });

  it('adds an unrecognised current language so selecting from the list cannot silently drop it', () => {
    const options = getCodeLanguageOptions('rust');

    expect(options[0]).toEqual({ value: 'rust', label: 'rust' });
    expect(options).toHaveLength(OFFERED.length + 1);
  });

  // The case that would otherwise render an empty control: an alias resolves into the offered set, so
  // it must not be prepended as its own option.
  it.each(['yml', 'YAML'])('does not add %s as its own option, since it resolves to one', (current) => {
    const values = getCodeLanguageOptions(current).map((option) => option.value);

    expect(values).toEqual(OFFERED);
  });
});
