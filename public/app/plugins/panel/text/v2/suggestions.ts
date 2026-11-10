import { findLast } from 'lodash';

import {
  type DataFrame,
  type Field,
  FieldType,
  getFieldDisplayName,
  type PreferredVisualisationType,
  ReducerID,
  TIME_SERIES_VALUE_FIELD_NAME,
  type VisualizationSuggestion,
  VisualizationSuggestionScore,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { type Options, RenderMode, TextMode } from '../panelcfg.gen';

import { isTextNewFeaturesEnabled } from './utils';

export const MAX_TEMPLATE_FIELDS = 50;
export const MAX_LIST_ROWS = 50;

const DEDICATED_VISUALIZATIONS: PreferredVisualisationType[] = ['logs', 'trace', 'nodeGraph', 'flamegraph'];

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const QUOTABLE_IN_REDUCER = /^[^"\\{}<\p{Cc}]+$/u;
const QUOTABLE_IN_ROW = /^[^"\\{}<:^\p{Cc}]+$/u;
const QUOTABLE_IN_HANDLEBARS = /^[^\\<\p{Cc}]+$/u;
const HANDLEBARS_KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'this']);

const ROWS_KEY = 'data';
const FORMATTED_VALUES_KEY = 'fmt';

interface TemplateField {
  label: string;
  path: string;
}

interface ListField extends TemplateField {
  emptyCondition?: string;
}

type TextSuggestion = VisualizationSuggestion<Options>;

export const textSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  const frames = dataSummary.rawFrames ?? [];

  if (
    !isTextNewFeaturesEnabled() ||
    !dataSummary.hasData ||
    frames.length !== 1 ||
    DEDICATED_VISUALIZATIONS.some((type) => dataSummary.hasPreferredVisualisationType(type))
  ) {
    return;
  }

  const isInstant = dataSummary.isInstant === true;
  const suggestions = getFrameSuggestions(frames[0], isInstant);

  return suggestions?.map((suggestion) => ({ ...suggestion, score: VisualizationSuggestionScore.OK }));
};

function getFrameSuggestions(frame: DataFrame, isInstant: boolean): TextSuggestion[] | undefined {
  const valueFields = frame.fields.filter(isValueField);
  const summaryFields = valueFields.filter(showsLastValue);
  const numberFields = summaryFields.filter((field) => field.type === FieldType.number);

  if (frame.length === 1) {
    return getSummarySuggestions(getFieldTemplate(frame, summaryFields, QUOTABLE_IN_REDUCER), undefined);
  }

  if (isTimeSeries(frame, isInstant)) {
    return numberFields.length > 0
      ? getSummarySuggestions(
          getFieldTemplate(frame, summaryFields, QUOTABLE_IN_REDUCER),
          hasSeveralValues(numberFields) ? getFieldTemplate(frame, numberFields, QUOTABLE_IN_REDUCER) : undefined
        )
      : undefined;
  }

  if (hasFieldOfType(frame, FieldType.string)) {
    return frame.length <= MAX_LIST_ROWS ? getListSuggestions(frame, valueFields) : undefined;
  }

  const samples = getFieldTemplate(frame, numberFields, QUOTABLE_IN_REDUCER);

  return getSummarySuggestions(samples, hasSeveralValues(numberFields) ? samples : undefined);
}

function getSummarySuggestions(
  summary: TemplateField[] | undefined,
  statistics: TemplateField[] | undefined
): TextSuggestion[] | undefined {
  if (!summary?.length) {
    return;
  }

  const suggestions: TextSuggestion[] = [
    {
      name: t('textng.suggestions.summary', 'Text - summary'),
      options: getOptions(getSummaryContent(summary)),
    },
  ];

  if (statistics?.length) {
    suggestions.push({
      name: t('textng.suggestions.statistics', 'Text - statistics'),
      options: getOptions(getStatisticsContent(statistics)),
    });
  }

  return suggestions;
}

function getListSuggestions(frame: DataFrame, valueFields: Field[]): TextSuggestion[] | undefined {
  const labelField = valueFields.find((field) => field.type === FieldType.string);
  const rowKeys = frame.fields.map((field) => getFieldDisplayName(field, frame));

  if (!labelField || rowKeys.includes(ROWS_KEY)) {
    return;
  }

  const listFields = [labelField, ...valueFields.filter((field) => field !== labelField)].slice(0, MAX_TEMPLATE_FIELDS);
  const fields = getFieldTemplate(frame, listFields, QUOTABLE_IN_ROW);

  if (!fields || !listFields.some((field) => field.values.some(isShown))) {
    return;
  }

  const [label, ...values] = fields.map(
    (field, index): ListField => ({ ...field, emptyCondition: getEmptyCondition(listFields[index], frame, rowKeys) })
  );

  return [
    {
      name: t('textng.suggestions.list', 'Text - list'),
      options: getOptions(getListContent(label, values), RenderMode.PerRow),
    },
  ];
}

function getEmptyCondition(field: Field, frame: DataFrame, rowKeys: string[]): string | undefined {
  const key = getFieldDisplayName(field, frame);
  const path = getFormattedValuePath(key);

  if (!path || rowKeys.includes(FORMATTED_VALUES_KEY) || rowKeys.indexOf(key) !== rowKeys.lastIndexOf(key)) {
    return;
  }

  return `(eq ${path} "")`;
}

function getFormattedValuePath(key: string): string | undefined {
  if (IDENTIFIER.test(key) && !HANDLEBARS_KEYWORDS.has(key)) {
    return `${FORMATTED_VALUES_KEY}.${key}`;
  }

  return QUOTABLE_IN_HANDLEBARS.test(key) ? `${FORMATTED_VALUES_KEY}.[${key.replace(/]/g, '\\]')}]` : undefined;
}

function getFieldTemplate(frame: DataFrame, fields: Field[], quotable: RegExp): TemplateField[] | undefined {
  const template: TemplateField[] = [];

  for (const field of fields.slice(0, MAX_TEMPLATE_FIELDS)) {
    const path = getFieldPath(frame, field, quotable);

    if (path === undefined) {
      return;
    }

    template.push({ label: getLabel(getFieldDisplayName(field, frame)), path });
  }

  return template;
}

function isTimeSeries(frame: DataFrame, isInstant: boolean): boolean {
  return hasFieldOfType(frame, FieldType.time) && !isInstant;
}

function hasFieldOfType(frame: DataFrame, type: FieldType): boolean {
  return frame.fields.some((field) => field.type === type);
}

function isValueField(field: Field): boolean {
  return field.type === FieldType.number || field.type === FieldType.string;
}

// With fewer than two values, every statistic would only repeat the same one.
function hasSeveralValues(fields: Field[]): boolean {
  return fields.some((field) => field.values.filter(hasValue).length > 1);
}

function hasValue(value: unknown): boolean {
  return value != null && !Number.isNaN(value);
}

function isShown(value: unknown): boolean {
  return hasValue(value) && value !== '';
}

function showsLastValue(field: Field): boolean {
  return isShown(findLast(field.values, hasValue));
}

function getFieldPath(frame: DataFrame, field: Field, quotable: RegExp): string | undefined {
  const names = frame.fields.map((other) => other.name);
  const isUnique = names.indexOf(field.name) === names.lastIndexOf(field.name);
  const namePath = isUnique ? getNamePath(field.name, quotable) : undefined;

  if (namePath) {
    return namePath;
  }

  const index = frame.fields.indexOf(field);

  return names.includes(String(index)) ? undefined : `.fields[${index}]`;
}

function getNamePath(name: string, quotable: RegExp): string | undefined {
  if (IDENTIFIER.test(name)) {
    return `.fields.${name}`;
  }

  return quotable.test(name) ? `.fields["${name}"]` : undefined;
}

function getLabel(name: string): string {
  return escapeMarkdown(name) || TIME_SERIES_VALUE_FIELD_NAME;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*[\]|~&@]/g, '\\$&')
    .replace(/:(?=\/\/)/g, '\\:')
    .replace(/\b(www)\./gi, '$1\\.')
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_')
    .replace(/\$/g, '&#36;')
    .replace(/</g, '&lt;')
    .replace(/\{(?=\{)|(?<=\{)\{/g, '\\{');
}

function getReducerMacro(path: string, reducer: ReducerID): string {
  return `\${__data${path}:reduce:${reducer}}`;
}

function getRowMacro(path: string): string {
  return `\${__data${path}}`;
}

function getSummaryContent(fields: TemplateField[]): string {
  return fields.map(({ label, path }) => `- **${label}**: ${getReducerMacro(path, ReducerID.lastNotNull)}`).join('\n');
}

function getStatisticsContent(fields: TemplateField[]): string {
  const statistics = [
    { reducer: ReducerID.lastNotNull, name: t('textng.suggestions.statistic-last', 'Last') },
    { reducer: ReducerID.min, name: t('textng.suggestions.statistic-min', 'Min') },
    { reducer: ReducerID.mean, name: t('textng.suggestions.statistic-mean', 'Mean') },
    { reducer: ReducerID.max, name: t('textng.suggestions.statistic-max', 'Max') },
  ];

  const header = [t('textng.suggestions.statistic-field', 'Field'), ...statistics.map(({ name }) => name)];
  const alignment = ['---', ...statistics.map(() => '---:')];
  const rows = fields.map(({ label, path }) => [
    label,
    ...statistics.map(({ reducer }) => getReducerMacro(path, reducer)),
  ]);

  return [header.map(escapeMarkdown), alignment, ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function getListContent(label: ListField, values: ListField[]): string {
  const name = getRowMacro(label.path);

  if (values.length === 0) {
    return getBlockUnless(label.emptyCondition, `- <span>${name}</span>`);
  }

  const details = values.length === 1 ? getRowMacro(values[0].path) : getNamedValues(values);
  const item = `- ${getInlineUnless(label.emptyCondition, `<strong>${name}</strong>: `)}<span>${details}</span>`;
  const valuesEmpty = getAllEmptyCondition(values);

  if (!valuesEmpty) {
    return item;
  }

  return [
    `{{#unless ${valuesEmpty}}}`,
    item,
    label.emptyCondition ? `{{else unless ${label.emptyCondition}}}` : '{{else}}',
    `- <strong>${name}</strong>`,
    '{{/unless}}',
  ].join('\n');
}

function getNamedValues(values: ListField[]): string {
  return values
    .map((value, index) => {
      const separator = index === 0 ? '' : getInlineUnless(getAllEmptyCondition(values.slice(0, index)), ', ');

      return getInlineUnless(value.emptyCondition, `${separator}${value.label} ${getRowMacro(value.path)}`);
    })
    .join('');
}

function getAllEmptyCondition(fields: ListField[]): string | undefined {
  const conditions = fields.flatMap(({ emptyCondition }) => (emptyCondition ? [emptyCondition] : []));

  if (conditions.length === 0 || conditions.length < fields.length) {
    return;
  }

  return conditions.length === 1 ? conditions[0] : `(and ${conditions.join(' ')})`;
}

function getInlineUnless(condition: string | undefined, content: string): string {
  return condition ? `{{#unless ${condition}}}${content}{{/unless}}` : content;
}

function getBlockUnless(condition: string | undefined, content: string): string {
  return condition ? [`{{#unless ${condition}}}`, content, '{{/unless}}'].join('\n') : content;
}

function getOptions(content: string, renderMode = RenderMode.Once): Partial<Options> {
  const noData = escapeMarkdown(t('textng.suggestions.no-data', 'No data'));
  const count = renderMode === RenderMode.PerRow ? 'data.length' : 'frames.length';

  return {
    mode: TextMode.Markdown,
    renderMode,
    content: [`{{#if (eq ${count} 0)}}`, noData, '{{else}}', content, '{{/if}}'].join('\n'),
  };
}
