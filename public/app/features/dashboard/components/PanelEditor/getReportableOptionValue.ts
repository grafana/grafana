export type OptionValueType = 'boolean' | 'number' | 'string' | 'array' | 'object' | 'null' | 'undefined';

export interface ReportableOptionValue {
  value?: string;
  value_type: OptionValueType;
}

/**
 * What an option change may send to analytics. Many option editors take typed input (text, units, regexes,
 * Text panel content, display names), so the value is only sent when it cannot be free text: a boolean, a
 * number, or a string picked from the fixed list of choices the editor declares in `settings.options`.
 */
export function getReportableOptionValue(value: unknown, settings: unknown): ReportableOptionValue {
  const value_type = getOptionValueType(value);

  if (value_type === 'boolean' || value_type === 'number' || isFixedChoice(value, settings)) {
    return { value: JSON.stringify(value), value_type };
  }

  return { value_type };
}

function getOptionValueType(value: unknown): OptionValueType {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }

  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'undefined':
      return 'undefined';
    default:
      return 'object';
  }
}

function isFixedChoice(value: unknown, settings: unknown): boolean {
  if (typeof value !== 'string' || !hasOptionList(settings)) {
    return false;
  }

  // A select that allows custom values still lists only the declared choices here, so a typed value is not
  // matched and stays unreported.
  return settings.options.some((option) => isChoiceWithValue(option, value));
}

function hasOptionList(settings: unknown): settings is { options: unknown[] } {
  return typeof settings === 'object' && settings !== null && 'options' in settings && Array.isArray(settings.options);
}

function isChoiceWithValue(option: unknown, value: string): boolean {
  return typeof option === 'object' && option !== null && 'value' in option && option.value === value;
}
