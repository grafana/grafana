import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';
import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

// The spec stores `language` as a free-form string, so it is deliberately NOT narrowed to
// CodeMirrorEditorLanguage anywhere: a notebook may legitimately arrive carrying a language the
// editor cannot highlight, and that value has to survive a round trip rather than be coerced away.

// A Record rather than an array so adding a ninth language to CodeMirrorEditorLanguage fails to
// compile here until it is given a label, instead of silently missing from the picker.
// Wording matches the text panel's picker so the two features read the same.
const HIGHLIGHTED_LANGUAGES: Record<CodeMirrorEditorLanguage, string> = {
  go: 'Go',
  html: 'HTML',
  json: 'JSON',
  markdown: 'Markdown',
  sql: 'SQL',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
};

/**
 * Offered by the picker but rendered unhighlighted, because neither has CodeMirror highlight tags
 * wired up yet (see the note on toCodeMirrorLanguage).
 *
 * Listed anyway: they are the two most common languages in an observability notebook, and the picker
 * is the only way to set a language — so leaving them out would mean a promql cell could be read but
 * never authored.
 */
const UNHIGHLIGHTED_LANGUAGES: Record<string, string> = {
  promql: 'PromQL',
  logql: 'LogQL',
};

/**
 * Spellings a notebook can arrive with from outside the picker. `language` is a bare `z.string()` in
 * the spec schema, so a hand-written notebook, an import, or an assistant-authored spec can carry any
 * of these — and the picker itself now stores whatever a user types into it.
 */
const LANGUAGE_ALIASES: Record<string, CodeMirrorEditorLanguage> = {
  yml: 'yaml',
  ts: 'typescript',
};

// Plain text is the absence of a language, and '' is what the schema defaults `language` to. It is
// also what the markdown export wants: an empty info string produces a correct bare fence.
export const PLAIN_TEXT_LANGUAGE = '';

/**
 * Stored languages are compared case-insensitively and untrimmed values tolerated, because the picker
 * now writes free text and nothing outside it is constrained either.
 */
export function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase();
}

// Own keys only. `in` would also answer true for 'constructor', 'toString' and the rest of
// Object.prototype, and since `language` is free-form those reach here: the value would be narrowed
// to a language the loader has no branch for, which surfaces as a "syntax highlighting failed to
// load" alert, and the label lookup would hand a function to React.
function isHighlightable(language: string): language is CodeMirrorEditorLanguage {
  return Object.hasOwn(HIGHLIGHTED_LANGUAGES, language);
}

/**
 * The language to highlight with, or undefined to render the code unhighlighted.
 *
 * CodeMirror supports eight languages against Monaco's ~80, so anything else falls back to no
 * highlighting. That includes promql and logql: `@grafana/lezer-logql` is already a root dependency
 * and exports a parser, and promql has an official upstream grammar with its tags applied
 * (`@prometheus-io/lezer-promql`) — what neither has yet is CodeMirror highlight tags wired up in
 * `@grafana/ui`. Adding them is a `@grafana/ui` change, per ADDING_LANGUAGES.md.
 */
export function toCodeMirrorLanguage(language: string): CodeMirrorEditorLanguage | undefined {
  const normalized = normalizeLanguage(language);

  if (isHighlightable(normalized)) {
    return normalized;
  }

  // Object.hasOwn for the same reason as above: a bare lookup would resolve 'constructor' to Object's.
  return Object.hasOwn(LANGUAGE_ALIASES, normalized) ? LANGUAGE_ALIASES[normalized] : undefined;
}

/**
 * The value the picker should show for a stored language: normalised, with aliases resolved to the
 * language they highlight as.
 *
 * The picker's `value` and its options have to agree on this, or a cell stored as `yml` highlights as
 * YAML while rendering an empty control. Resolving here rather than rewriting the spec means nothing
 * is silently migrated on render — the stored value only changes when the user picks a language.
 */
export function canonicalLanguage(language: string): string {
  const normalized = normalizeLanguage(language);

  return toCodeMirrorLanguage(normalized) ?? normalized;
}

/** Display name for a language, falling back to the stored value for anything unrecognised. */
export function codeLanguageLabel(language: string): string {
  const canonical = canonicalLanguage(language);

  if (canonical === PLAIN_TEXT_LANGUAGE) {
    return t('notebook.cell.code.language-plain-text', 'Plain text');
  }

  if (isHighlightable(canonical)) {
    return HIGHLIGHTED_LANGUAGES[canonical];
  }

  return Object.hasOwn(UNHIGHLIGHTED_LANGUAGES, canonical) ? UNHIGHLIGHTED_LANGUAGES[canonical] : canonical;
}

/**
 * Picker options, with the cell's current language prepended when it is one the picker does not offer.
 * Without that an unrecognised language renders as an empty control, and the first interaction would
 * replace a value the notebook was authored with.
 */
export function getCodeLanguageOptions(current: string): Array<ComboboxOption<string>> {
  const offered: Array<ComboboxOption<string>> = [
    { value: PLAIN_TEXT_LANGUAGE, label: codeLanguageLabel(PLAIN_TEXT_LANGUAGE) },
    ...Object.entries(HIGHLIGHTED_LANGUAGES).map(([value, label]) => ({ value, label })),
    ...Object.entries(UNHIGHLIGHTED_LANGUAGES).map(([value, label]) => ({ value, label })),
  ];

  // Membership of what is offered, not "can it be highlighted": promql is offered without
  // highlighting, and testing the latter would list it twice.
  const canonical = canonicalLanguage(current);
  if (offered.some((option) => option.value === canonical)) {
    return offered;
  }

  return [{ value: canonical, label: codeLanguageLabel(canonical) }, ...offered];
}
