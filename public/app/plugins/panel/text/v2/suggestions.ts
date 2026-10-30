import {
  type DataFrame,
  type Field,
  FieldType,
  getFieldDisplayName,
  type PreferredVisualisationType,
  ReducerID,
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

interface TemplateField {
  label: string;
  path: string;
}

type TextSuggestion = VisualizationSuggestion<Options>;

export const textSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  const frames = dataSummary.rawFrames ?? [];
  const [frame] = frames;

  if (
    !isTextNewFeaturesEnabled() ||
    !dataSummary.hasData ||
    dataSummary.frameCount !== 1 ||
    !frame ||
    DEDICATED_VISUALIZATIONS.some((type) => dataSummary.hasPreferredVisualisationType(type))
  ) {
    return;
  }

  return getSuggestions(frame, frames, dataSummary.isInstant === true)?.map((suggestion) => ({
    ...suggestion,
    score: VisualizationSuggestionScore.OK,
  }));
};

function getSuggestions(frame: DataFrame, frames: DataFrame[], isInstant: boolean): TextSuggestion[] | undefined {
  const numberFields = frame.fields.filter((field) => field.type === FieldType.number);
  const valueFields = frame.fields.filter(
    (field) => field.type === FieldType.number || field.type === FieldType.string
  );

  if (frame.length === 1) {
    return getSummarySuggestions(frame, frames, valueFields, []);
  }

  if (hasFieldOfType(frame, FieldType.time) && !isInstant) {
    return numberFields.length > 0 ? getSummarySuggestions(frame, frames, valueFields, numberFields) : undefined;
  }

  if (hasFieldOfType(frame, FieldType.string)) {
    return frame.length <= MAX_LIST_ROWS ? getListSuggestions(frame, frames, valueFields) : undefined;
  }

  return getSummarySuggestions(frame, frames, numberFields, numberFields);
}

function getSummarySuggestions(
  frame: DataFrame,
  frames: DataFrame[],
  summaryFields: Field[],
  statisticFields: Field[]
): TextSuggestion[] | undefined {
  const summary = getTemplateFields(frame, frames, summaryFields, QUOTABLE_IN_REDUCER);

  if (!summary?.length) {
    return;
  }

  const suggestions: TextSuggestion[] = [
    {
      name: t('textng.suggestions.summary', 'Text - summary'),
      options: getOptions(getSummaryContent(summary)),
    },
  ];

  const statistics = statisticFields.some((field) => field.values.some(hasValue))
    ? getTemplateFields(frame, frames, statisticFields, QUOTABLE_IN_REDUCER)
    : undefined;

  if (statistics?.length) {
    suggestions.push({
      name: t('textng.suggestions.statistics', 'Text - statistics'),
      options: getOptions(getStatisticsContent(statistics)),
    });
  }

  return suggestions;
}

function getListSuggestions(frame: DataFrame, frames: DataFrame[], valueFields: Field[]): TextSuggestion[] | undefined {
  const labelField = valueFields.find((field) => field.type === FieldType.string);

  if (!labelField || frame.fields.some((field) => getFieldDisplayName(field, frame, frames) === 'data')) {
    return;
  }

  const fields = getTemplateFields(
    frame,
    frames,
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

function getTemplateFields(
  frame: DataFrame,
  frames: DataFrame[],
  fields: Field[],
  quotable: RegExp
): TemplateField[] | undefined {
  const templateFields: TemplateField[] = [];

  for (const field of fields.slice(0, MAX_TEMPLATE_FIELDS)) {
    const path = getFieldPath(frame, field, quotable);

    if (path === undefined) {
      return;
    }

    templateFields.push({ label: escapeMarkdown(getFieldDisplayName(field, frame, frames)), path });
  }

  return templateFields;
}

function hasFieldOfType(frame: DataFrame, type: FieldType): boolean {
  return frame.fields.some((field) => field.type === type);
}

function hasValue(value: unknown): boolean {
  return value != null && !Number.isNaN(value);
}

function getFieldPath(frame: DataFrame, field: Field, quotable: RegExp): string | undefined {
  const names = frame.fields.map((other) => other.name);
  const isUnique = names.filter((name) => name === field.name).length === 1;

  if (isUnique && IDENTIFIER.test(field.name)) {
    return `.${field.name}`;
  }

  if (isUnique && quotable.test(field.name)) {
    return `["${field.name}"]`;
  }

  const index = frame.fields.indexOf(field);

  return names.includes(String(index)) ? undefined : `[${index}]`;
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
  return `\${__data.fields${path}:reduce:${reducer}}`;
}

function getRowMacro(path: string): string {
  return `\${__data.fields${path}}`;
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
