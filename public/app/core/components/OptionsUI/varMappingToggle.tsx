import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import {
  type FieldConfigPropertyItem,
  type SelectableValue,
  type StandardEditorProps,
  standardEditorsRegistry,
} from '@grafana/data';
import { getVarMappingOptions, type VarMappingKind } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Button, Combobox, type ComboboxOption, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  getDisallowedValues,
  getVarMappingChecks,
  getVarMappingVariableName,
  VarMappingChecks,
} from './varMappingChecks';
import {
  getFallbackVarMappingVariables,
  type NewVarMappingVariable,
  useVarMappingVariableUpdates,
  type VarMappingVariable,
  type VarMappingVariableSource,
  type VarMappingVariableValue,
} from './varMappingVariables';

export type VarMappingToggleKind = Extract<VarMappingKind, 'option' | 'boolean' | 'number'>;

/**
 * The kind to edit through `VarMappingToggleEditor`, or `undefined` for properties with their own
 * expression editor. Selects, radios and switches can't hold an expression, and sliders keep the
 * slider; other numbers use the always-text `VarMappingNumberValueEditor`.
 */
export function getVarMappingToggleKind(
  item: Pick<FieldConfigPropertyItem, 'editor'>,
  kind: VarMappingKind | undefined
): VarMappingToggleKind | undefined {
  if (kind === 'option' || kind === 'boolean') {
    return kind;
  }
  if (kind === 'number' && item.editor === standardEditorsRegistry.getIfExists('slider')?.editor) {
    return kind;
  }
  return undefined;
}

type Props = StandardEditorProps<unknown> & {
  /** The control shown while no expression is set */
  editor: FieldConfigPropertyItem['editor'];
  kind: VarMappingToggleKind;
  /** The expression kept in `varMappings`; `value` is the stored value, used as the fallback */
  expression?: string;
  /** The dashboard variables; without it the picker lists variable names only */
  variables?: VarMappingVariableSource;
};

const NEW_VARIABLE = '__grafana_new_var_mapping_variable__';

/**
 * Wraps a select, radio, switch or slider so it can take a dashboard variable instead. `onChange`
 * gets either a plain value or an expression string, the same contract as the other `varMappings`
 * editors, so callers route it with `isVarMappingExpressionInput`. Turning the toggle off writes
 * the stored value back, which drops the expression under the existing plain-value rule.
 */
export const VarMappingToggleEditor = ({
  editor: Editor,
  kind,
  expression,
  value,
  onChange,
  item,
  context,
  id,
  variables: source,
}: Props) => {
  const styles = useStyles2(getStyles);
  // Variable mode without an expression yet, between turning the toggle on and the first pick
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isVariableMode = expression !== undefined || isEditing;

  // Only variable mode shows variables, so plain controls don't re-render on variable changes
  useVarMappingVariableUpdates(isVariableMode ? source : undefined);

  // Once picked, the expression itself keeps variable mode on, so removing it from outside the
  // editor goes back to the plain control
  if (expression !== undefined && isEditing) {
    setIsEditing(false);
  }

  // Opened after the picker has mounted, not with it: the Combobox sizes its list from the input
  // element, which doesn't exist yet on its first render, and an already-open list is never resized
  const openOnMount = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      setIsOpen(true);
    }
  }, []);

  const itemOptions = getVarMappingOptions(item.settings);
  const newValues = source?.createVariable ? getNewVariableValues(kind, itemOptions) : undefined;

  const toggle = () => {
    if (!isVariableMode) {
      setIsEditing(true);
      return;
    }
    setIsEditing(false);
    setIsOpen(false);
    if (expression !== undefined) {
      onChange(value);
    }
  };

  const toggleButton = (
    <Button
      icon="gf-variable"
      variant="secondary"
      fill={isVariableMode ? 'solid' : 'text'}
      aria-pressed={isVariableMode}
      aria-label={t('options-ui.var-mapping-toggle.use-variable', 'Use variable')}
      tooltip={
        isVariableMode
          ? t('options-ui.var-mapping-toggle.use-fixed-value', 'Use a fixed value')
          : t('options-ui.var-mapping-toggle.use-variable', 'Use variable')
      }
      onClick={toggle}
    />
  );

  if (!isVariableMode) {
    return (
      <Stack alignItems="center" gap={1}>
        <div className={styles.control}>
          <Editor value={value} onChange={onChange} item={item} context={context} id={id} />
        </div>
        {toggleButton}
      </Stack>
    );
  }

  const variables = source?.getVariables() ?? getFallbackVarMappingVariables();
  const newVariable = newValues && {
    name: getNewVariableName(kind, item, variables),
    values: newValues,
  };
  const newVariableExists = newVariable !== undefined && variables.some(({ name }) => name === newVariable.name);

  const createOrReuse = () => {
    if (!newVariable || !source?.createVariable) {
      return;
    }
    const isInScope = source.createVariable({
      ...newVariable,
      type: kind === 'boolean' ? 'switch' : 'custom',
      current: getNewVariableCurrent(kind, value, newVariable.values),
    });
    if (isInScope) {
      onChange(`\${${newVariable.name}}`);
    }
  };

  // `$name` and `${name}` select their variable; any other expression, such as one edited in the
  // JSON, isn't in the options, so the picker shows it as is until a variable is picked
  const variableName = getVarMappingVariableName(expression);
  const selected = variableName ? `\${${variableName}}` : (expression ?? null);
  const checks =
    expression === undefined
      ? []
      : getVarMappingChecks({
          kind,
          settings: item.settings,
          expression,
          interpolate: source?.interpolate ?? context.replaceVariables,
          variables,
        });
  // Once the expression is known to resolve, the allowed values and the fallback are only noise
  const hint = checks.length > 0 && !checks.some((check) => check.warning) ? '' : getHint(kind, item, value);

  return (
    <Stack direction="column" gap={0.5}>
      <Stack alignItems="center" gap={1}>
        <div className={styles.control} ref={isEditing ? openOnMount : undefined}>
          <Combobox
            id={id}
            options={getPickerOptions(kind, item.settings, variables, newVariable, newVariableExists)}
            value={selected}
            placeholder={t('options-ui.var-mapping-toggle.placeholder', 'Choose a variable')}
            aria-label={t('options-ui.var-mapping-toggle.aria-label-picker', 'Variable for {{name}}', {
              name: item.name,
              interpolation: { escapeValue: false },
            })}
            autoFocus={expression === undefined}
            isOpen={isOpen}
            onIsOpenChange={setIsOpen}
            onChange={(option) => {
              if (option.value === NEW_VARIABLE) {
                createOrReuse();
                return;
              }
              if (option.value !== expression) {
                onChange(option.value);
              }
            }}
          />
        </div>
        {toggleButton}
      </Stack>
      <VarMappingChecks checks={checks} />
      {hint && (
        <Text variant="bodySmall" color="secondary">
          {hint}
        </Text>
      )}
    </Stack>
  );
};

function getPickerOptions(
  kind: VarMappingToggleKind,
  settings: unknown,
  variables: VarMappingVariable[],
  newVariable: { name: string; values: VarMappingVariableValue[] } | undefined,
  newVariableExists: boolean
): Array<ComboboxOption<string>> {
  const matching = new Set(
    variables.filter((variable) => hasOnlyAllowedValues(kind, settings, variable)).map((variable) => variable.name)
  );
  // Groups only help once some variable is known to match; otherwise the list stays flat
  const getGroup = (name: string) =>
    matching.size === 0
      ? undefined
      : matching.has(name)
        ? t('options-ui.var-mapping-toggle.group-matching', 'Matching values')
        : t('options-ui.var-mapping-toggle.group-other', 'Other variables');

  const options: Array<ComboboxOption<string>> = [...variables]
    .sort((a, b) => Number(matching.has(b.name)) - Number(matching.has(a.name)))
    .map((variable) => ({
      value: `\${${variable.name}}`,
      label: variable.name,
      description: !variable.current
        ? undefined
        : t('options-ui.var-mapping-toggle.option-current', 'Current: {{current}}', {
            current: variable.current,
            interpolation: { escapeValue: false },
          }),
      group: getGroup(variable.name),
    }));

  if (newVariable) {
    options.unshift({
      value: NEW_VARIABLE,
      label: newVariableExists
        ? t('options-ui.var-mapping-toggle.existing-variable', 'Use existing variable {{name}}', {
            name: newVariable.name,
            interpolation: { escapeValue: false },
          })
        : t('options-ui.var-mapping-toggle.new-variable', 'New variable with these values'),
      // An existing variable keeps its own values, which its entry in the list shows
      description: newVariableExists ? undefined : newVariable.values.map((option) => option.value).join(', '),
      icon: newVariableExists ? 'gf-variable' : 'plus',
    });
  }

  return options;
}

/** The values a new variable gets: the select's options, or on and off for a switch */
function getNewVariableValues(
  kind: VarMappingToggleKind,
  itemOptions: Array<SelectableValue<unknown>>
): VarMappingVariableValue[] | undefined {
  if (kind === 'boolean') {
    return [
      { value: 'true', label: t('options-ui.var-mapping-toggle.fallback-on', 'On') },
      { value: 'false', label: t('options-ui.var-mapping-toggle.fallback-off', 'Off') },
    ];
  }
  if (kind !== 'option') {
    return undefined;
  }

  const values = itemOptions
    .filter((option) => option.value !== undefined)
    .map((option) => ({ value: String(option.value), label: option.label ?? String(option.value) }));
  return values.length > 0 ? values : undefined;
}

/** Starts the new variable on the stored value, so creating it changes nothing visually */
function getNewVariableCurrent(
  kind: VarMappingToggleKind,
  value: unknown,
  values: VarMappingVariableValue[]
): NewVarMappingVariable['current'] {
  if (kind === 'boolean') {
    return String(Boolean(value));
  }
  return values.find((option) => option.value === String(value))?.value ?? values[0].value;
}

/** The last segment of the property path, e.g. `drawStyle` */
function hasOnlyAllowedValues(kind: VarMappingToggleKind, settings: unknown, variable: VarMappingVariable): boolean {
  return Boolean(variable.values?.length) && getDisallowedValues(kind, settings, variable.values ?? []).length === 0;
}

/**
 * Named after the property, so picking it again reuses the variable instead of adding copies. A
 * variable with that name whose values don't all fit the option isn't reused, since names like
 * `mode` are common, so the new one gets a numbered name instead.
 */
function getNewVariableName(kind: VarMappingToggleKind, item: Props['item'], variables: VarMappingVariable[]): string {
  const baseName = item.id.split('.').pop()?.replace(/\W/g, '_') || 'variable';
  for (let n = 1; ; n++) {
    const name = n === 1 ? baseName : `${baseName}_${n}`;
    const existing = variables.find((variable) => variable.name === name);
    if (!existing || hasOnlyAllowedValues(kind, item.settings, existing)) {
      return name;
    }
  }
}

function getHint(kind: VarMappingToggleKind, item: Props['item'], value: unknown): string {
  // The interpolated values are plain text in a React child, which React escapes already
  const interpolation = { escapeValue: false };

  if (kind === 'number') {
    return value == null
      ? ''
      : t('options-ui.var-mapping-toggle.hint-number', 'Falls back to: {{fallback}}', {
          fallback: String(value),
          interpolation,
        });
  }

  if (kind === 'boolean') {
    return t('options-ui.var-mapping-toggle.hint-boolean', 'Allowed values: true, false. Falls back to: {{fallback}}', {
      fallback: value
        ? t('options-ui.var-mapping-toggle.fallback-on', 'On')
        : t('options-ui.var-mapping-toggle.fallback-off', 'Off'),
      interpolation,
    });
  }

  const options = getVarMappingOptions(item.settings);
  const values = options
    .filter((option) => option.value !== undefined)
    .map((option) => String(option.value))
    .join(', ');
  const fallback =
    options.find((option) => option.value === value)?.label ?? (value == null ? undefined : String(value));

  if (fallback === undefined) {
    return t('options-ui.var-mapping-toggle.hint-option-no-fallback', 'Allowed values: {{values}}', {
      values,
      interpolation,
    });
  }

  return t('options-ui.var-mapping-toggle.hint-option', 'Allowed values: {{values}}. Falls back to: {{fallback}}', {
    values,
    fallback,
    interpolation,
  });
}

const getStyles = () => ({
  control: css({
    flexGrow: 1,
    minWidth: 0,
  }),
});
