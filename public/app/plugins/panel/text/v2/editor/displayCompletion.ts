import { t } from '@grafana/i18n';
import { type CodeMirrorCompletionContext, type CodeMirrorCompletionResult } from '@grafana/ui/unstable';

import { DISPLAY_PROPERTIES, type DisplayProperty } from '../handlebars';

const HELPER = 'display';
const CALL_START = String.raw`\{\{(?:[{#~&]*|[^{}]*\()\s*`;
const QUOTED = String.raw`(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*')`;

const HELPER_BEFORE_CURSOR = new RegExp(`(?<=${CALL_START})[A-Za-z]*$`);
const PROPERTY_BEFORE_CURSOR = new RegExp(`(?<=${CALL_START}${HELPER}\\s+${QUOTED}\\s+["'])\\w*$`);

const FIELD_QUOTES = [
  {
    quote: '"',
    beforeCursor: new RegExp(`(?<=${CALL_START}${HELPER}\\s+")(?:\\\\"|[^"])*$`),
    validFor: /^(?:\\"|[^"])*$/,
  },
  {
    quote: "'",
    beforeCursor: new RegExp(`(?<=${CALL_START}${HELPER}\\s+')(?:\\\\'|[^'])*$`),
    validFor: /^(?:\\'|[^'])*$/,
  },
];

const getPropertyInfo = (): Record<DisplayProperty, string> => ({
  text: t(
    'textng.display-completion.text',
    'Formatted value without its unit, or the text of the value mapping that matched'
  ),
  prefix: t('textng.display-completion.prefix', 'Unit shown before the value, such as $'),
  suffix: t('textng.display-completion.suffix', 'Unit shown after the value, such as %'),
  numeric: t('textng.display-completion.numeric', 'Value as a number'),
  color: t('textng.display-completion.color', 'Color of the value mapping that matched, or else of the threshold'),
  percent: t(
    'textng.display-completion.percent',
    'Position of the value from 0 to 1, between the lowest and highest values across all numeric fields, unless the query results set a field min or max'
  ),
  icon: t('textng.display-completion.icon', 'Icon of the value mapping that matched'),
});

function completeProperty(context: CodeMirrorCompletionContext): CodeMirrorCompletionResult | null {
  const match = context.matchBefore(PROPERTY_BEFORE_CURSOR);
  if (!match) {
    return null;
  }

  const info = getPropertyInfo();

  return {
    from: match.from,
    options: DISPLAY_PROPERTIES.map((property) => ({ label: property, info: info[property], type: 'property' })),
    validFor: /^\w*$/,
  };
}

function completeField(context: CodeMirrorCompletionContext, fieldNames: string[]): CodeMirrorCompletionResult | null {
  for (const { quote, beforeCursor, validFor } of FIELD_QUOTES) {
    const match = context.matchBefore(beforeCursor);
    if (match) {
      return {
        from: match.from,
        options: fieldNames
          .filter((name) => !name.endsWith('\\'))
          .map((name) => ({ label: name, apply: name.split(quote).join(`\\${quote}`), type: 'variable' })),
        validFor,
      };
    }
  }

  return null;
}

function completeHelper(context: CodeMirrorCompletionContext): CodeMirrorCompletionResult | null {
  const match = context.matchBefore(HELPER_BEFORE_CURSOR);
  const typed = match?.text ?? '';
  const requested = context.explicit || typed.length > 0;

  if (!match || !requested || typed === HELPER || !HELPER.startsWith(typed)) {
    return null;
  }

  return {
    from: match.from,
    options: [
      {
        label: HELPER,
        detail: '"field" "property"',
        info: t(
          'textng.display-completion.helper',
          'Display value of a field on the current row: formatted text, unit, and value mapping or threshold color'
        ),
        type: 'function',
      },
    ],
    filter: false,
  };
}

export function displayCompletion(
  fieldNames: string[]
): (context: CodeMirrorCompletionContext) => CodeMirrorCompletionResult | null {
  return (context) => completeProperty(context) ?? completeField(context, fieldNames) ?? completeHelper(context);
}
