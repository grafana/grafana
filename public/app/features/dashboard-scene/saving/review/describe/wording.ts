import {
  displayNameOverrideProcessor,
  fieldColorModeRegistry,
  getValueFormats,
  isNestedPanelOptions,
  PanelOptionsEditorBuilder,
  type PanelPlugin,
  rangeUtil,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  stringOverrideProcessor,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { isRecord } from 'app/core/utils/isRecord';

import { humanizeKey, noEscape } from '../richText';
import { type ReviewChange } from '../types';

import { escapeSegment, hasPrefix, isUnset, safely, unescapeSegment, valueAt } from './paths';

// --- Labels ---

/** Labels of known spec fields. Functions, so they're translated on use rather than at import. */
export const labels = {
  title: () => t('dashboard-scene.review.field.title', 'Title'),
  description: () => t('dashboard-scene.review.field.description', 'Description'),
  subtitle: () => t('dashboard-scene.review.field.subtitle', 'Subtitle'),
  editable: () => t('dashboard-scene.review.field.editable', 'Editable'),
  preload: () => t('dashboard-scene.review.field.preload', 'Preload panels'),
  liveNow: () => t('dashboard-scene.review.field.live-now', 'Refresh live dashboards'),
  cursorSync: () => t('dashboard-scene.review.field.cursor-sync', 'Graph tooltip'),
  defaultGrid: () => t('dashboard-scene.review.field.default-grid', 'Default grid'),
  timeRange: () => t('dashboard-scene.review.field.time-range', 'Default time range'),
  timezone: () => t('dashboard-scene.review.field.timezone', 'Time zone'),
  weekStart: () => t('dashboard-scene.review.field.week-start', 'Week start'),
  autoRefresh: () => t('dashboard-scene.review.field.auto-refresh', 'Auto refresh'),
  autoRefreshIntervals: () => t('dashboard-scene.review.field.auto-refresh-intervals', 'Auto refresh intervals'),
  nowDelay: () => t('dashboard-scene.review.field.now-delay', 'Now delay'),
  hideTimepicker: () => t('dashboard-scene.review.field.hide-timepicker', 'Hide time picker'),
  quickRanges: () => t('dashboard-scene.review.field.quick-ranges', 'Quick ranges'),
  fiscalYearStartMonth: () => t('dashboard-scene.review.field.fiscal-year-start-month', 'Fiscal year start month'),
  transparent: () => t('dashboard-scene.review.field.transparent', 'Transparent background'),
  libraryPanel: () => t('dashboard-scene.review.field.library-panel', 'Library panel'),
  maxDataPoints: () => t('dashboard-scene.review.field.max-data-points', 'Max data points'),
  minInterval: () => t('dashboard-scene.review.field.min-interval', 'Min interval'),
  timeFrom: () => t('dashboard-scene.review.field.time-from', 'Relative time'),
  timeShift: () => t('dashboard-scene.review.field.time-shift', 'Time shift'),
  timeCompare: () => t('dashboard-scene.review.field.time-compare', 'Time comparison'),
  hideTimeOverride: () => t('dashboard-scene.review.field.hide-time-override', 'Hide time info'),
  cacheTimeout: () => t('dashboard-scene.review.field.cache-timeout', 'Cache timeout'),
  queryCachingTTL: () => t('dashboard-scene.review.field.query-caching-ttl', 'Cache TTL'),
  visualization: () => t('dashboard-scene.review.field.visualization', 'Visualization'),
  pluginVersion: () => t('dashboard-scene.review.field.plugin-version', 'Plugin version'),
  options: () => t('dashboard-scene.review.field.options', 'Options'),
  fieldConfig: () => t('dashboard-scene.review.field.field-config', 'Field config'),
};

/** Joins label parts into a path: "Legend › Mode". */
export function joinLabel(parts: readonly string[]): string {
  const cleaned = parts.filter((part, index) => part && part !== parts[index - 1]);
  return cleaned.reduce((parent, child) =>
    t('dashboard-scene.review.label.path', '{{parent}} › {{child}}', { parent, child, interpolation: noEscape })
  );
}

/** A humanized label for escaped path segments: ['legend', 'showLegend'] → "Legend › Show legend". */
export function humanizePath(segments: readonly string[]): string {
  if (!segments.length) {
    return '';
  }
  return joinLabel(segments.map((segment) => humanizeKey(unescapeSegment(segment))));
}

interface OptionLabel {
  /** Path segments below `options` (plugin options) or `fieldConfig.defaults` (field config). */
  path: string[];
  label: string;
  /** The editor categories the option sits in, outermost first. */
  category: string[];
  /** Position in the editor, for a stable order within a category. */
  order: number;
  /** The editor's words for a value: a choice's label or a unit's name; undefined shows the raw value. */
  display?: (value: unknown) => string | undefined;
  /** Edited in a text box: its values are free text, shown quoted. */
  textInput?: boolean;
}

interface EditorItemLike {
  path: string;
  name: string;
  category?: string[];
  settings?: unknown;
  editor?: unknown;
}

/** Labels of a panel plugin's options and field config, as the panel editor shows them. */
export interface PanelLabels {
  /** The plugin option whose path is the longest prefix of `rest`, or the options under `rest` when it's a group. */
  option(rest: readonly string[]): OptionLabel | undefined;
  /** For a path above several options (e.g. `legend`), the category they share. */
  optionGroup(rest: readonly string[]): { label: string; order: number } | undefined;
  /** The field config option whose id is the longest prefix of `rest` (below `fieldConfig.defaults`). */
  fieldConfig(rest: readonly string[]): OptionLabel | undefined;
}

export function getPanelLabels(
  plugin: PanelPlugin | undefined,
  options: Record<string, unknown> | undefined,
  fieldConfig: unknown
): PanelLabels {
  if (!plugin) {
    return { option: () => undefined, optionGroup: () => undefined, fieldConfig: () => undefined };
  }
  let optionLabels: OptionLabel[] | undefined;
  const getOptionLabels = () => {
    optionLabels ??= safely(() => collectPluginOptions(plugin, options ?? {}, fieldConfig)) ?? [];
    return optionLabels;
  };
  return {
    option: (rest) => findLabel(getOptionLabels(), rest),
    optionGroup: (rest) => {
      const below = getOptionLabels().filter((label) => label.path.length > rest.length && hasPrefix(label.path, rest));
      const category = below[0]?.category;
      if (!category?.length || !below.every((label) => label.category.join('/') === category.join('/'))) {
        return undefined;
      }
      return { label: joinLabel(category), order: below[0].order };
    },
    fieldConfig: (rest) => findLabel(fieldConfigOptionsOf(plugin), rest),
  };
}

function findLabel(labels: OptionLabel[], rest: readonly string[]): OptionLabel | undefined {
  let best: OptionLabel | undefined;
  for (const label of labels) {
    if (hasPrefix(rest, label.path)) {
      if (!best || label.path.length > best.path.length) {
        best = label;
      }
    }
  }
  return best;
}

function collectPluginOptions(plugin: PanelPlugin, options: Record<string, unknown>, fieldConfig: unknown) {
  const labels: OptionLabel[] = [];
  const builder = new PanelOptionsEditorBuilder<Record<string, unknown>>();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  plugin.getPanelOptionsSupplier()(builder, { data: [], options, fieldConfig } as never);
  const fallbackCategory = plugin.meta?.name ?? '';
  addOptionItems(labels, builder.getItems(), [], (path) => path, fallbackCategory, options);
  return labels;
}

function addOptionItems(
  labels: OptionLabel[],
  items: unknown[],
  parentCategory: string[],
  toParentPath: (path: string) => string,
  fallbackCategory: string,
  options: Record<string, unknown>
) {
  for (const item of items) {
    if (isNestedPanelOptions(item)) {
      const category = item.category?.[0] ? [...parentCategory, item.category[0]] : parentCategory;
      const access = item.getNestedValueAccess({
        getValue: (path: string) => path,
        onChange: () => {},
      });
      const subBuilder = new PanelOptionsEditorBuilder<Record<string, unknown>>();
      const subOptions = readDotted(options, toParentPath(item.path));
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      item.getBuilder()(subBuilder, { data: [], options: subOptions } as never);
      addOptionItems(
        labels,
        subBuilder.getItems(),
        category.length ? category : [fallbackCategory],
        (path) => toParentPath(String(access.getValue(path))),
        fallbackCategory,
        options
      );
      continue;
    }
    if (!isEditorItem(item)) {
      continue;
    }
    const category = parentCategory.length
      ? item.category?.[0]
        ? [...parentCategory, item.category[0]]
        : parentCategory
      : [item.category?.[0] ?? fallbackCategory];
    labels.push({
      path: toParentPath(item.path).split('.'),
      label: joinLabel([...category, item.name]),
      category,
      order: labels.length,
      display: choiceLabels(item.settings),
      textInput: isTextEditor(item.editor),
    });
  }
}

// Unlike plugin options, which can depend on the panel's options, field config labels are the plugin's own.
const fieldConfigOptions = new WeakMap<PanelPlugin, OptionLabel[]>();

function fieldConfigOptionsOf(plugin: PanelPlugin): OptionLabel[] {
  let labels = fieldConfigOptions.get(plugin);
  if (!labels) {
    labels = safely(() => collectFieldConfigOptions(plugin));
    if (labels) {
      fieldConfigOptions.set(plugin, labels);
    }
  }
  return labels ?? [];
}

function collectFieldConfigOptions(plugin: PanelPlugin): OptionLabel[] {
  return plugin.fieldConfigRegistry.list().map((item, order) => ({
    path: item.id.split('.'),
    label: joinLabel([...(item.category?.[0] ? [item.category[0]] : []), item.name]),
    category: item.category?.[0] ? [item.category[0]] : [],
    order,
    display: item.id === 'unit' ? unitName : choiceLabels(item.settings),
    textInput: isTextFieldConfig(item),
  }));
}

/** Field config typed into a text box: its editor is the text input, or it is processed as a plain string. */
function isTextFieldConfig(
  item: { id?: string; editor?: unknown; process?: unknown; settings?: unknown } | undefined
): boolean {
  // Units and choices are processed as strings too, but they are picked, not typed.
  if (!item || item.id === 'unit' || choiceLabels(item.settings)) {
    return false;
  }
  return (
    isTextEditor(item.editor) ||
    item.process === stringOverrideProcessor ||
    item.process === displayNameOverrideProcessor
  );
}

function isTextEditor(editor: unknown): boolean {
  const text = safely(() => standardEditorsRegistry.getIfExists('text')?.editor);
  return text !== undefined && editor === text;
}

/** Without the plugin, the standard field config options (display name, no value, …) still say which are text. */
export function isStandardTextFieldConfig(id: string): boolean {
  return isTextFieldConfig(safely(() => standardFieldConfigEditorRegistry.getIfExists(id)));
}

/** The label of an option's choice (select, radio), when the option offers fixed choices. */
function choiceLabels(settings: unknown): ((value: unknown) => string | undefined) | undefined {
  const choices = isRecord(settings) && Array.isArray(settings.options) ? settings.options : undefined;
  if (!choices) {
    return undefined;
  }
  return (value) => {
    const choice: unknown = choices.find((option: unknown) => isRecord(option) && option.value === value);
    return isRecord(choice) && typeof choice.label === 'string' ? choice.label : undefined;
  };
}

let unitNames: Map<string, string> | undefined;

/** A unit's name as the unit picker shows it: 'none' → "Number", 'percent' → "Percent (0-100)". */
function unitName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  unitNames ??= new Map(
    (safely(() => getValueFormats()) ?? []).flatMap((category) =>
      (category.submenu ?? []).map((format): [string, string] => [String(format.value), format.text])
    )
  );
  return unitNames.get(value);
}

function isEditorItem(item: unknown): item is EditorItemLike {
  return (
    typeof item === 'object' &&
    item !== null &&
    'path' in item &&
    typeof item.path === 'string' &&
    'name' in item &&
    typeof item.name === 'string'
  );
}

function readDotted(root: Record<string, unknown>, path: string): Record<string, unknown> {
  const value = valueAt(root, path.split('.').map(escapeSegment));
  return isRecord(value) && !Array.isArray(value) ? { ...value } : {};
}

/** A field color as the color scheme picker names it: "From thresholds", "Single color (red)". */
export function displayColorScheme(value: unknown): string | undefined {
  const mode = isRecord(value) ? value.mode : undefined;
  if (!isRecord(value) || typeof mode !== 'string') {
    return undefined;
  }
  const name = safely(() => fieldColorModeRegistry.getIfExists(mode)?.name) ?? mode;
  if (mode === 'fixed' && typeof value.fixedColor === 'string') {
    return t('dashboard-scene.review.value.color-fixed', '{{name}} ({{color}})', {
      name,
      color: value.fixedColor,
      interpolation: noEscape,
    });
  }
  return name;
}

// --- Formatters ---

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
    return { ...added(label), details: { after: () => detail(after) } };
  }
  if (isUnset(after)) {
    return { ...removed(label), details: { before: () => detail(before) } };
  }
  return { ...changed(label), details: { before: () => detail(before), after: () => detail(after) } };
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
  return String(value);
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
