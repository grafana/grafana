import {
  displayNameOverrideProcessor,
  fieldColorModeRegistry,
  getValueFormats,
  isNestedPanelOptions,
  PanelOptionsEditorBuilder,
  type PanelPlugin,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  stringOverrideProcessor,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { safely, unescapeSegment } from './paths';

const noEscape = { escapeValue: false };

/** Joins label parts into a path: "Legend › Mode". */
export function joinLabel(parts: readonly string[]): string {
  const cleaned = parts.filter((part, index) => part && part !== parts[index - 1]);
  return cleaned.reduce((parent, child) =>
    t('dashboard-scene.review.label.path', '{{parent}} › {{child}}', { parent, child, interpolation: noEscape })
  );
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

/** A humanized label for escaped path segments: ['legend', 'showLegend'] → "Legend › Show legend". */
export function humanizePath(segments: readonly string[]): string {
  if (!segments.length) {
    return '';
  }
  return joinLabel(segments.map((segment) => humanizeKey(unescapeSegment(segment))));
}

export interface OptionLabel {
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
  /** Translated plugin name. */
  pluginName?: string;
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
  let fieldLabels: OptionLabel[] | undefined;
  const getOptionLabels = () => {
    optionLabels ??= safely(() => collectPluginOptions(plugin, options ?? {}, fieldConfig)) ?? [];
    return optionLabels;
  };
  return {
    pluginName: plugin.meta?.name,
    option: (rest) => findLabel(getOptionLabels(), rest),
    optionGroup: (rest) => {
      const below = getOptionLabels().filter(
        (label) => label.path.length > rest.length && rest.every((segment, index) => label.path[index] === segment)
      );
      const category = below[0]?.category;
      if (!category?.length || !below.every((label) => label.category.join('/') === category.join('/'))) {
        return undefined;
      }
      return { label: joinLabel(category), order: below[0].order };
    },
    fieldConfig: (rest) => {
      fieldLabels ??= safely(() => collectFieldConfigOptions(plugin)) ?? [];
      return findLabel(fieldLabels, rest);
    },
  };
}

function findLabel(labels: OptionLabel[], rest: readonly string[]): OptionLabel | undefined {
  let best: OptionLabel | undefined;
  for (const label of labels) {
    if (label.path.length <= rest.length && label.path.every((segment, index) => segment === rest[index])) {
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
  const choices = isRecordLike(settings) && Array.isArray(settings.options) ? settings.options : undefined;
  if (!choices) {
    return undefined;
  }
  return (value) => {
    const choice: unknown = choices.find((option: unknown) => isRecordLike(option) && option.value === value);
    return isRecordLike(choice) && typeof choice.label === 'string' ? choice.label : undefined;
  };
}

let unitNames: Map<string, string> | undefined;

/** A unit's name as the unit picker shows it: 'none' → "Number", 'percent' → "Percent (0-100)". */
export function unitName(value: unknown): string | undefined {
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

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  let current: unknown = root;
  for (const key of path.split('.')) {
    current = typeof current === 'object' && current !== null ? Reflect.get(current, key) : undefined;
  }
  return typeof current === 'object' && current !== null && !Array.isArray(current) ? { ...current } : {};
}

/** A field color as the color scheme picker names it: "From thresholds", "Single color (red)". */
export function displayColorScheme(value: unknown): string | undefined {
  const mode = isRecordLike(value) ? value.mode : undefined;
  if (!isRecordLike(value) || typeof mode !== 'string') {
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
