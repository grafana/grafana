import { type InterpolateFunction, type NumberFieldConfigSettings } from '@grafana/data';
import {
  getVarMappingOptions,
  hasVarMappingVariableReference,
  interpolateVarMapping,
  resolveVarMappingText,
  type VarMappingKind,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { getRangeText } from './NumberInput';
import { type VarMappingVariable, type VarMappingVariableValue } from './varMappingVariables';

export type VarMappingCheckKind = Exclude<VarMappingKind, 'string'>;

export interface VarMappingCheck {
  text: string;
  warning?: boolean;
}

const SINGLE_VARIABLE = /^\$(?:(\w+)|\{(\w+)\})$/;
// Data macros resolve for each field when the panel renders, but the checks have no field
const DATA_MACRO = /\$\{?__(?:field|series|value|data)\b/;

/** The variable name of a `$name` or `${name}` expression, or `undefined` for any other expression */
export function getVarMappingVariableName(expression: string | undefined): string | undefined {
  const match = expression?.match(SINGLE_VARIABLE);
  return match ? (match[1] ?? match[2]) : undefined;
}

interface GetChecksOptions {
  kind: VarMappingCheckKind;
  /** The property settings, which hold a select's options and a number's range */
  settings: unknown;
  expression: string;
  interpolate: InterpolateFunction | undefined;
  variables: VarMappingVariable[];
}

/**
 * What the expression resolves to right now, checked with the panel's own resolution so the editor
 * can't disagree with what renders, plus the values of a known variable that would fall back.
 */
export function getVarMappingChecks({
  kind,
  settings,
  expression,
  interpolate,
  variables,
}: GetChecksOptions): VarMappingCheck[] {
  if (!interpolate) {
    return [];
  }

  const text = interpolateVarMapping(expression, { replaceVariables: interpolate });
  if (text === undefined) {
    return [
      {
        text: t(
          'options-ui.var-mapping-checks.not-one-value',
          "The variable doesn't have exactly one value selected, so the fallback is used"
        ),
        warning: true,
      },
    ];
  }
  if (DATA_MACRO.test(text)) {
    return [
      {
        text: t('options-ui.var-mapping-checks.data-macro', 'Resolves for each field when the panel renders'),
      },
    ];
  }
  // The interpolators leave an unknown variable in the text, while built-in ones resolve
  if (hasVarMappingVariableReference(text)) {
    return [
      {
        text: t('options-ui.var-mapping-checks.not-found', 'Variable not found, so the fallback is used'),
        warning: true,
      },
    ];
  }

  const checks: VarMappingCheck[] = [];
  const resolved = resolveVarMappingText(kind, text, settings);
  checks.push(
    resolved === undefined
      ? { text: getRejectedText(kind, text, settings), warning: true }
      : {
          text: t('options-ui.var-mapping-checks.resolves', 'Resolves to: {{resolved}}', {
            resolved: getVarMappingValueLabel(kind, settings, resolved),
            interpolation: { escapeValue: false },
          }),
        }
  );

  const variableName = getVarMappingVariableName(expression);
  const variable = variables.find((candidate) => candidate.name === variableName);
  const disallowed = variable?.values ? getDisallowedValues(kind, settings, variable.values) : [];
  if (disallowed.length > 0) {
    checks.push({
      text: t('options-ui.var-mapping-checks.values', 'These values use the fallback: {{values}}', {
        values: disallowed.map((option) => option.value).join(', '),
        interpolation: { escapeValue: false },
      }),
      warning: true,
    });
  }

  return checks;
}

function getRejectedText(kind: VarMappingCheckKind, text: string, settings: unknown): string {
  if (kind !== 'number') {
    return t(
      'options-ui.var-mapping-checks.not-allowed',
      'Current value "{{current}}" isn\'t allowed, so the fallback is used',
      { current: text, interpolation: { escapeValue: false } }
    );
  }

  // Without the settings, only the range can reject a number
  if (resolveVarMappingText('number', text) === undefined) {
    return t(
      'options-ui.var-mapping-checks.not-number',
      'Current value "{{current}}" isn\'t a number, so the fallback is used',
      { current: text, interpolation: { escapeValue: false } }
    );
  }

  const { min, max }: NumberFieldConfigSettings = typeof settings === 'object' && settings !== null ? settings : {};
  return t(
    'options-ui.var-mapping-checks.out-of-range',
    'Current value {{current}} is out of range, so the fallback is used. {{range}}',
    { current: text, range: getRangeText(min, max), interpolation: { escapeValue: false } }
  );
}

/** The known values of a variable that wouldn't resolve, so would use the fallback */
export function getDisallowedValues(
  kind: VarMappingCheckKind,
  settings: unknown,
  values: VarMappingVariableValue[]
): VarMappingVariableValue[] {
  return values.filter((option) => resolveVarMappingText(kind, option.value, settings) === undefined);
}

function getVarMappingValueLabel(kind: VarMappingCheckKind, settings: unknown, value: unknown): string {
  if (kind === 'boolean') {
    return value
      ? t('options-ui.var-mapping-toggle.fallback-on', 'On')
      : t('options-ui.var-mapping-toggle.fallback-off', 'Off');
  }
  return getVarMappingOptions(settings).find((option) => option.value === value)?.label ?? String(value);
}

export const VarMappingChecks = ({ checks }: { checks: VarMappingCheck[] }) =>
  checks.map((check, index) => (
    <Text key={index} variant="bodySmall" color={check.warning ? 'warning' : 'secondary'}>
      {check.text}
    </Text>
  ));
