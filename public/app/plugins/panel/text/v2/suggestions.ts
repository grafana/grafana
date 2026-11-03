import { of } from 'rxjs';

import {
  type DataFrame,
  type DataTransformerConfig,
  DataTransformerID,
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
import { mergeTransformer } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { type Options, RenderMode, TextMode } from '../panelcfg.gen';

import { isTextNewFeaturesEnabled } from './utils';

export const MAX_TEMPLATE_FIELDS = 50;
export const MAX_LIST_ROWS = 50;
export const MAX_MERGED_FRAMES = 50;

const DEDICATED_VISUALIZATIONS: PreferredVisualisationType[] = ['logs', 'trace', 'nodeGraph', 'flamegraph'];

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const QUOTABLE_IN_REDUCER = /^[^"\\{}<\p{Cc}]+$/u;
const QUOTABLE_IN_ROW = /^[^"\\{}<:^\p{Cc}]+$/u;

interface TemplateField {
  label: string;
  path: string;
}

type TextSuggestion = VisualizationSuggestion<Options>;

export const textSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  const frames = dataSummary.rawFrames ?? [];

  if (
    !isTextNewFeaturesEnabled() ||
    !dataSummary.hasData ||
    frames.length === 0 ||
    DEDICATED_VISUALIZATIONS.some((type) => dataSummary.hasPreferredVisualisationType(type))
  ) {
    return;
  }

  const isInstant = dataSummary.isInstant === true;
  const suggestions =
    frames.length === 1 ? getFrameSuggestions(frames[0], isInstant) : getMergedSuggestions(frames, isInstant);

  return suggestions?.map((suggestion) => ({ ...suggestion, score: VisualizationSuggestionScore.OK }));
};

function getFrameSuggestions(frame: DataFrame, isInstant: boolean): TextSuggestion[] | undefined {
  const numberFields = frame.fields.filter((field) => field.type === FieldType.number);
  const valueFields = frame.fields.filter(isValueField);

  if (frame.length === 1) {
    return getSummarySuggestions(getFieldTemplate(frame, valueFields, QUOTABLE_IN_REDUCER), undefined);
  }

  if (isTimeSeries(frame, isInstant)) {
    return numberFields.length > 0
      ? getSummarySuggestions(
          getFieldTemplate(frame, valueFields, QUOTABLE_IN_REDUCER),
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

/**
 * Text renders one frame at a time, so several frames are offered through a Merge series/tables
 * transformation, and the templates read the frame it produces like any other.
 */
function getMergedSuggestions(frames: DataFrame[], isInstant: boolean): TextSuggestion[] | undefined {
  // Merge slows down with the square of the frame count, and would run for each preview and refresh.
  const timeField = frames.length <= MAX_MERGED_FRAMES ? getMergeTimeField(frames) : undefined;

  if (timeField === undefined) {
    return;
  }

  const merged = mergeFrames(frames);
  const sortField = merged ? getSortField(merged, timeField) : undefined;

  if (!merged || sortField === undefined || !keepsSeriesNames(frames, merged)) {
    return;
  }

  return getFrameSuggestions(merged, isInstant)?.map((suggestion) => ({
    ...suggestion,
    description: t(
      'textng.suggestions.merged-description',
      '{{name}}: adds transformations that merge the series into one table',
      { name: suggestion.name }
    ),
    transformations: getMergeTransformations(sortField),
  }));
}

/**
 * The time field to merge `frames` on, if merging leaves each series whole. Merge joins rows on the
 * fields every frame has, and collapses any other repeated name into a single column.
 */
function getMergeTimeField(frames: DataFrame[]): string | undefined {
  const framesWithFields = frames.filter((frame) => frame.fields.length > 0);
  const timeField = framesWithFields[0]?.fields.find(
    ({ name, type }) =>
      type === FieldType.time &&
      framesWithFields.every((frame) =>
        frame.fields.some((field) => field.name === name && field.type === FieldType.time)
      )
  );

  if (!timeField) {
    return;
  }

  const fields = framesWithFields.flatMap((frame) => frame.fields);
  const joined = fields.filter((field) => field.name === timeField.name);
  const others = fields.filter((field) => field.name !== timeField.name).map((field) => field.name);

  return joined.length === framesWithFields.length &&
    new Set(others).size === others.length &&
    // A repeated timestamp would merge another frame's row into each of its rows, skewing that series.
    joined.every(({ values }) => new Set(values).size === values.length)
    ? timeField.name
    : undefined;
}

function mergeFrames(frames: DataFrame[]): DataFrame | undefined {
  let merged: DataFrame[] = [];

  mergeTransformer
    .operator(
      {},
      { interpolate: (value) => value }
    )(of(frames))
    .subscribe((result) => {
      merged = result;
    });

  return merged.length === 1 ? merged[0] : undefined;
}

/**
 * The name Sort by will find the time field under. It matches display names, which Merge can leave
 * different from the field's name, and takes the first match if another field displays the same.
 */
function getSortField(merged: DataFrame, timeField: string): string | undefined {
  const names = merged.fields.map((field) => getFieldDisplayName(field, merged));
  const name = names[merged.fields.findIndex((field) => field.name === timeField)];

  return names.indexOf(name) === names.lastIndexOf(name) ? name : undefined;
}

/**
 * Merge drops labels, frame names and display name overrides, so a series named by any of them would
 * come out called something else. A series read by its index could also come to show another series'
 * value, as the index moves when an earlier series is missing from a later query.
 */
function keepsSeriesNames(frames: DataFrame[], merged: DataFrame): boolean {
  const names = new Set<string>();

  for (const frame of frames) {
    for (const field of frame.fields.filter(isValueField)) {
      const name = getFieldDisplayName(field, frame, frames);
      const mergedField = merged.fields.find((candidate) => candidate.name === field.name);

      if (
        names.has(name) ||
        !mergedField ||
        getFieldDisplayName(mergedField, merged) !== name ||
        !getNamePath(field.name, QUOTABLE_IN_REDUCER)
      ) {
        return false;
      }

      names.add(name);
    }
  }

  return true;
}

function getMergeTransformations(sortField: string): DataTransformerConfig[] {
  return [
    { id: DataTransformerID.merge, options: {} },
    // Merge orders rows by when it first meets each timestamp. A timestamp only a later frame has lands
    // after that frame's newest row, where lastNotNull would read it as the latest value.
    { id: DataTransformerID.sortBy, options: { sort: [{ field: sortField }] } },
  ];
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

  if (!labelField || frame.fields.some((field) => getFieldDisplayName(field, frame) === 'data')) {
    return;
  }

  const fields = getFieldTemplate(
    frame,
    [labelField, ...valueFields.filter((field) => field !== labelField)],
    QUOTABLE_IN_ROW
  );

  if (!fields) {
    return;
  }

  const [label, ...values] = fields;

  return [
    {
      name: t('textng.suggestions.list', 'Text - list'),
      options: getOptions(getListContent(label, values), RenderMode.PerRow),
    },
  ];
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

function getListContent(label: TemplateField, values: TemplateField[]): string {
  const name = getRowMacro(label.path);

  if (values.length === 0) {
    return `- <span>${name}</span>`;
  }

  const details =
    values.length === 1
      ? getRowMacro(values[0].path)
      : values.map((value) => `${value.label} ${getRowMacro(value.path)}`).join(', ');

  return `- <strong>${name}</strong>: ${details}`;
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
