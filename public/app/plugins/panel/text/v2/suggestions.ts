import {
  type DataFrame,
  type Field,
  FieldType,
  getFieldDisplayName,
  ReducerID,
  type VisualizationSuggestion,
  VisualizationSuggestionScore,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { type Options, RenderMode, TextMode } from '../panelcfg.gen';

import { isTextNewFeaturesEnabled } from './utils';

export const MAX_SUMMARY_FIELDS = 10;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const QUOTABLE = /^[^"\\{}<\p{Cc}]+$/u;

interface SummaryField {
  label: string;
  path: string;
}

export const textSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  const frames = dataSummary.rawFrames ?? [];
  const [frame] = frames;

  if (!isTextNewFeaturesEnabled() || !dataSummary.hasData || dataSummary.frameCount !== 1 || !frame) {
    return;
  }

  const isSingleRow = frame.length === 1;
  const isTimeSeries = hasFieldOfType(frame, FieldType.time) && !hasFieldOfType(frame, FieldType.string);

  if (!isSingleRow && !isTimeSeries) {
    return;
  }

  const numberFields = frame.fields.filter((field) => field.type === FieldType.number);

  if (
    numberFields.length === 0 ||
    numberFields.length > MAX_SUMMARY_FIELDS ||
    !numberFields.some((field) => field.values.some(hasValue))
  ) {
    return;
  }

  const fields: SummaryField[] = [];

  for (const field of numberFields) {
    const path = getFieldPath(frame, field);

    if (path === undefined) {
      return;
    }

    fields.push({ label: escapeMarkdown(getFieldDisplayName(field, frame, frames)), path });
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [
    {
      name: t('textng.suggestions.summary', 'Text - summary'),
      options: getOptions(getSummaryContent(fields)),
    },
  ];

  if (!isSingleRow) {
    suggestions.push({
      name: t('textng.suggestions.statistics', 'Text - statistics'),
      options: getOptions(getStatisticsContent(fields)),
    });
  }

  return suggestions.map((suggestion) => ({ ...suggestion, score: VisualizationSuggestionScore.OK }));
};

function hasFieldOfType(frame: DataFrame, type: FieldType): boolean {
  return frame.fields.some((field) => field.type === type);
}

function hasValue(value: unknown): boolean {
  return value != null && !Number.isNaN(value);
}

function getFieldPath(frame: DataFrame, field: Field): string | undefined {
  const names = frame.fields.map((other) => other.name);
  const isUnique = names.filter((name) => name === field.name).length === 1;

  if (isUnique && IDENTIFIER.test(field.name)) {
    return `.${field.name}`;
  }

  if (isUnique && QUOTABLE.test(field.name)) {
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

function getSummaryContent(fields: SummaryField[]): string {
  return fields.map(({ label, path }) => `- **${label}**: ${getReducerMacro(path, ReducerID.lastNotNull)}`).join('\n');
}

function getStatisticsContent(fields: SummaryField[]): string {
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

function getOptions(content: string): Partial<Options> {
  const noData = escapeMarkdown(t('textng.suggestions.no-data', 'No data'));

  return {
    mode: TextMode.Markdown,
    renderMode: RenderMode.Once,
    content: ['{{#if (eq frames.length 0)}}', noData, '{{else}}', content, '{{/if}}'].join('\n'),
  };
}
