import { mapValues } from 'lodash';

import { t } from '@grafana/i18n';

import { type NamedElement, type RichText } from './types';

/** Interpolation option for every text that embeds titles: they are shown as is, and React escapes them. */
export const noEscape = { escapeValue: false };

// Never found in a translation or a title, so it can't be confused with real text
const SENTINEL = '\u0000';

/**
 * Builds rich text from one whole translated sentence, so translators can reorder its parts. `render` gets a
 * placeholder per part and passes them to `t()` as interpolation values; the parts are then spliced back in.
 * Call `t()` with a literal key inside `render`, so `make i18n-extract` finds it:
 *
 *   rich({ name, parent }, (p) =>
 *     t('dashboard-scene.review.node.added-under', 'Added {{name}} under {{parent}}', { ...p, interpolation: noEscape })
 *   )
 */
export function rich<K extends string>(
  parts: Record<K, RichText | string>,
  render: (placeholders: Record<K, string>) => string
): RichText {
  const placeholders = mapValues(parts, (_, key) => `${SENTINEL}${key}${SENTINEL}`);
  const byKey = new Map<string, RichText | string>(Object.entries(parts));
  const result: RichText = [];
  render(placeholders)
    .split(SENTINEL)
    .forEach((piece, index) => {
      if (index % 2 === 0) {
        append(result, piece);
        return;
      }
      const part = byKey.get(piece) ?? piece;
      for (const item of typeof part === 'string' ? [part] : part) {
        append(result, item);
      }
    });
  return result;
}

/** A panel, row or tab by its title, e.g. `"CPU"`, or `(unnamed)`. */
export function named(kind: NamedElement['kind'], title: string): NamedElement {
  return {
    kind,
    name: title
      ? t('dashboard-scene.review.name.titled', '"{{title}}"', { title, interpolation: noEscape })
      : t('dashboard-scene.review.name.unnamed', '(unnamed)'),
  };
}

/** A section path segment by segment: `Tab "Cluster" › Row "Nodes"`. */
export function joinPath(parent: RichText, child: RichText): RichText {
  return rich({ parent, child }, (p) =>
    t('dashboard-scene.review.name.section-path', '{{parent}} › {{child}}', { ...p, interpolation: noEscape })
  );
}

/** The same text with its named elements marked as the header's own node. */
export function asSelf(text: RichText): RichText {
  return text.map((part) => (typeof part === 'string' ? part : { ...part, self: true }));
}

/** The kind as a word, for screen readers and plain text. */
export function kindWord(kind: NamedElement['kind']): string {
  switch (kind) {
    case 'row':
      return t('dashboard.sidebar.elements.row', 'Row');
    case 'tab':
      return t('dashboard.sidebar.elements.tab', 'Tab');
    case 'panel':
    default:
      return t('dashboard.sidebar.elements.panel', 'Panel');
  }
}

/** Rich text with each named element as its kind word and name, e.g. `Added Row "New row" under Tab "Tab 1"`. */
export function richToPlain(text: RichText | string): string {
  if (typeof text === 'string') {
    return text;
  }
  return text.map((part) => (typeof part === 'string' ? part : plainName(part))).join('');
}

function plainName({ kind, name }: NamedElement): string {
  switch (kind) {
    case 'row':
      return t('dashboard-scene.review.plain.row', 'Row {{name}}', { name, interpolation: noEscape });
    case 'tab':
      return t('dashboard-scene.review.plain.tab', 'Tab {{name}}', { name, interpolation: noEscape });
    case 'panel':
    default:
      return t('dashboard-scene.review.plain.panel', 'Panel {{name}}', { name, interpolation: noEscape });
  }
}

/** Adjacent strings are merged and empty ones dropped, so equal texts have one shape. */
function append(result: RichText, part: string | NamedElement) {
  if (typeof part !== 'string') {
    result.push(part);
  } else if (part) {
    const last = result[result.length - 1];
    if (typeof last === 'string') {
      result[result.length - 1] = last + part;
    } else {
      result.push(part);
    }
  }
}

/** "showLegend" → "Show legend", "maxDataPoints" → "Max data points". */
export function humanizeKey(key: string): string {
  if (/^\d+$/.test(key)) {
    return t('dashboard-scene.review.label.list-item', 'Item {{number}}', { number: Number(key) + 1 });
  }
  const words = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word === word.toUpperCase() && word.length > 1 ? word : word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    });
  return words.join(' ') || key;
}
