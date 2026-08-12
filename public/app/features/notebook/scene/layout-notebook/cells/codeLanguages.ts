import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';
import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

// The spec stores `language` as a free-form string, so it is deliberately NOT narrowed to
// CodeMirrorEditorLanguage anywhere: a notebook may legitimately arrive carrying a language the
// editor cannot highlight (promql is the common one), and that value has to survive a round trip
// rather than be coerced away.

// A Record rather than an array so adding a ninth language to CodeMirrorEditorLanguage fails to
// compile here until it is given a label, instead of silently missing from the picker.
// Wording matches the text panel's picker so the two features read the same.
const LANGUAGE_LABELS: Record<CodeMirrorEditorLanguage, string> = {
  go: 'Go',
  html: 'HTML',
  json: 'JSON',
  markdown: 'Markdown',
  sql: 'SQL',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
};

// Plain text is the absence of a language, and '' is what the schema defaults `language` to. It is
// also what the markdown export wants: an empty info string produces a correct bare fence.
export const PLAIN_TEXT_LANGUAGE = '';

// Own keys only. `in` would also answer true for 'constructor', 'toString' and the rest of
// Object.prototype, and since `language` is free-form those reach here: the value would be narrowed
// to a language the loader has no branch for, which surfaces as a "syntax highlighting failed to
// load" alert, and the label lookup would hand a function to React.
function isHighlightable(language: string): language is CodeMirrorEditorLanguage {
  return Object.hasOwn(LANGUAGE_LABELS, language);
}

/**
 * The language to highlight with, or undefined to render the code unhighlighted.
 *
 * CodeMirror supports eight languages against Monaco's ~80, so anything else — including promql and
 * logql, which have no CodeMirror package in this repo — falls back to no highlighting.
 */
export function toCodeMirrorLanguage(language: string): CodeMirrorEditorLanguage | undefined {
  return isHighlightable(language) ? language : undefined;
}

/** Display name for a language, falling back to the stored value for anything unrecognised. */
export function codeLanguageLabel(language: string): string {
  if (language === PLAIN_TEXT_LANGUAGE) {
    return t('notebooks.cell.code.language-plain-text', 'Plain text');
  }

  return isHighlightable(language) ? LANGUAGE_LABELS[language] : language;
}

/**
 * Picker options, with the cell's current language prepended when it is one the editor does not know.
 * Without that an unrecognised language renders as an empty control, and the first interaction would
 * replace a value the notebook was authored with.
 */
export function getCodeLanguageOptions(current: string): Array<ComboboxOption<string>> {
  const known: Array<ComboboxOption<string>> = [
    { value: PLAIN_TEXT_LANGUAGE, label: codeLanguageLabel(PLAIN_TEXT_LANGUAGE) },
    ...Object.keys(LANGUAGE_LABELS)
      .filter(isHighlightable)
      .map((language) => ({ value: language, label: LANGUAGE_LABELS[language] })),
  ];

  if (current === PLAIN_TEXT_LANGUAGE || isHighlightable(current)) {
    return known;
  }

  return [{ value: current, label: current }, ...known];
}
