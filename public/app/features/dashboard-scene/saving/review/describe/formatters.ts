import { rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isRecord } from 'app/core/utils/isRecord';

import { type ReviewChange } from '../types';

import { isUnset } from './paths';

/** A worded change, before its claims are attached. */
export type Worded = Omit<ReviewChange, 'claims'>;

/** Shows a short value the way the UI does (e.g. an option's choice label); undefined falls back to the value. */
export type DisplayValue = (value: unknown) => string | undefined;

/** How a field's value is worded, chosen by the field's value type (WORDING.md §7). */
export type ValueFormat =
  /** By the values: boolean, short or long. */
  | { type: 'auto'; display?: DisplayValue; quoted?: boolean }
  /**
   * "Transparent background: turned on". `absent` is what a missing value means: off unless given, or
   * 'inherit' for an override that follows its layout.
   */
  | { type: 'boolean'; absent?: boolean | 'inherit' }
  /** Titles and names: always short, shown inline however long. */
  | { type: 'name'; display?: DisplayValue; quoted?: boolean }
  /** Free text (descriptions, subtitles): inline up to 60 characters on one line, long otherwise. */
  | { type: 'freeText'; quoted?: boolean }
  /** Thresholds: long, with readable steps as details. */
  | { type: 'thresholds' }
  /** Always long, e.g. thresholds or show/hide rules. */
  | { type: 'long' }
  /** A short value where "not set" is itself a value, e.g. auto refresh '' reads "Off". */
  | { type: 'unsetIsValue'; display: DisplayValue };

const noEscape = { escapeValue: false };

const SHORT_STRING_LENGTH = 40;
const SHORT_FREE_TEXT_LENGTH = 60;

export function describeValue(label: string, before: unknown, after: unknown, format: ValueFormat): Worded {
  switch (format.type) {
    case 'boolean':
      return describeBoolean(label, after, format.absent);
    case 'freeText':
      if (isShortOrUnset(before, SHORT_FREE_TEXT_LENGTH) && isShortOrUnset(after, SHORT_FREE_TEXT_LENGTH)) {
        return describeShort(label, before, after, undefined, format.quoted);
      }
      return describeLong(label, before, after);
    case 'long':
      return describeLong(label, before, after);
    case 'thresholds':
      return describeThresholds(label, before, after);
    case 'unsetIsValue':
      return { kind: 'changed', text: fromTo(label, format.display(before) ?? '', format.display(after) ?? '') };
    case 'name':
      return describeShort(label, before, after, format.display, format.quoted);
    case 'auto':
    default:
      if (isBooleanOrUnset(before) && isBooleanOrUnset(after) && (isBoolean(before) || isBoolean(after))) {
        return describeBoolean(label, after);
      }
      if (isShortOrUnset(before) && isShortOrUnset(after)) {
        // Only strings are typed into a text box: numbers and booleans stay unquoted.
        const quoted = format.quoted && typeof (isUnset(after) ? before : after) === 'string';
        return describeShort(label, before, after, format.display, quoted);
      }
      return describeLong(label, before, after);
  }
}

function describeBoolean(label: string, after: unknown, absent: boolean | 'inherit' = false): Worded {
  if (after === undefined && absent === 'inherit') {
    return {
      kind: 'changed',
      text: t('dashboard-scene.review.change.follows-layout', '{{label}}: set to follow the layout', {
        label,
        interpolation: noEscape,
      }),
    };
  }
  const on = after === undefined ? absent === true : Boolean(after);
  return {
    kind: 'changed',
    text: on
      ? t('dashboard-scene.review.change.turned-on', '{{label}}: turned on', { label, interpolation: noEscape })
      : t('dashboard-scene.review.change.turned-off', '{{label}}: turned off', { label, interpolation: noEscape }),
  };
}

/**
 * "Min interval: 1m → 30s", "set to 500", "cleared (was 500)". Free text typed into a text box is quoted, by
 * keys of its own so the quotes are the translation's.
 */
function describeShort(label: string, before: unknown, after: unknown, display?: DisplayValue, quoted = false): Worded {
  const show = (value: unknown) => display?.(value) ?? displayShort(value);
  if (isUnset(before) && isUnset(after)) {
    return changed(label);
  }
  const options = { label, interpolation: noEscape };
  if (isUnset(before)) {
    const value = show(after);
    return {
      kind: 'changed',
      text: quoted
        ? t('dashboard-scene.review.change.set-to-text', '{{label}}: set to "{{value}}"', { ...options, value })
        : t('dashboard-scene.review.change.set-to', '{{label}}: set to {{value}}', { ...options, value }),
    };
  }
  if (isUnset(after)) {
    const value = show(before);
    return {
      kind: 'changed',
      text: quoted
        ? t('dashboard-scene.review.change.cleared-text', '{{label}}: cleared (was "{{value}}")', { ...options, value })
        : t('dashboard-scene.review.change.cleared', '{{label}}: cleared (was {{value}})', { ...options, value }),
    };
  }
  if (quoted) {
    return {
      kind: 'changed',
      text: t('dashboard-scene.review.change.from-to-text', '{{label}}: "{{before}}" → "{{after}}"', {
        ...options,
        before: show(before),
        after: show(after),
      }),
    };
  }
  return { kind: 'changed', text: fromTo(label, show(before), show(after)) };
}

export function describeLong(
  label: string,
  before: unknown,
  after: unknown,
  detail: (value: unknown) => string = detailOf
): Worded {
  if (isUnset(before) && isUnset(after)) {
    return changed(label);
  }
  if (isUnset(before)) {
    return { ...added(label), details: { after: detail(after) } };
  }
  if (isUnset(after)) {
    return { ...removed(label), details: { before: detail(before) } };
  }
  return { ...changed(label), details: { before: detail(before), after: detail(after) } };
}

/** Steps one per line in stored order, "Base: green" then "80: red"; the mode first when the sides differ in it. */
function describeThresholds(label: string, before: unknown, after: unknown): Worded {
  const mode = (value: unknown) => (isRecord(value) ? value.mode : undefined);
  const showMode = !isUnset(before) && !isUnset(after) && mode(before) !== mode(after);
  return describeLong(label, before, after, (value) => thresholdLines(value, showMode));
}

function thresholdLines(value: unknown, showMode: boolean): string {
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    return detailOf(value);
  }
  const lines: string[] = [];
  if (showMode) {
    lines.push(
      value.mode === 'percentage'
        ? t('dashboard-scene.review.value.thresholds-mode-percentage', 'Mode: Percentage')
        : t('dashboard-scene.review.value.thresholds-mode-absolute', 'Mode: Absolute')
    );
  }
  value.steps.forEach((step: unknown, index) => {
    const color = isRecord(step) ? String(step.color ?? '') : '';
    lines.push(
      index === 0
        ? t('dashboard-scene.review.value.thresholds-base', 'Base: {{color}}', { color, interpolation: noEscape })
        : t('dashboard-scene.review.value.thresholds-step', '{{value}}: {{color}}', {
            value: isRecord(step) ? String(step.value) : '',
            color,
            interpolation: noEscape,
          })
    );
  });
  return lines.join('\n');
}

export function added(label: string): Worded {
  return {
    kind: 'added',
    text: t('dashboard-scene.review.change.added', '{{label}}: added', { label, interpolation: noEscape }),
  };
}

export function removed(label: string): Worded {
  return {
    kind: 'removed',
    text: t('dashboard-scene.review.change.removed', '{{label}}: removed', { label, interpolation: noEscape }),
  };
}

export function changed(label: string): Worded {
  return {
    kind: 'changed',
    text: t('dashboard-scene.review.change.changed', '{{label}}: changed', { label, interpolation: noEscape }),
  };
}

export function fromTo(label: string, before: string, after: string): string {
  return t('dashboard-scene.review.change.from-to', '{{label}}: {{before}} → {{after}}', {
    label,
    before,
    after,
    interpolation: noEscape,
  });
}

export function detailOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2) ?? '';
}

export function displayShort(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

export function displayAutoRefresh(value: unknown): string {
  return isUnset(value) ? t('dashboard-scene.review.value.refresh-off', 'Off') : displayShort(value);
}

export function displayTimeRange(from: unknown, to: unknown): string {
  if (typeof from !== 'string' || typeof to !== 'string') {
    return '';
  }
  try {
    return rangeUtil.describeTimeRange({ from, to });
  } catch {
    return t('dashboard-scene.review.value.time-range', '{{from}} to {{to}}', { from, to, interpolation: noEscape });
  }
}

export function isShort(value: unknown, length = SHORT_STRING_LENGTH): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  return typeof value === 'string' && value.length <= length && !value.includes('\n');
}

function isShortOrUnset(value: unknown, length = SHORT_STRING_LENGTH): boolean {
  return isUnset(value) || isShort(value, length);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isBooleanOrUnset(value: unknown): boolean {
  return value === undefined || isBoolean(value);
}
