import { useMemo, useState, type FocusEvent, type FormEvent } from 'react';

import {
  type DataFrame,
  type KeyValue,
  type TransformerUIProps,
  getFieldDisplayName,
  stringToJsRegex,
  type SelectableValue,
} from '@grafana/data';
import { type FilterFieldsByNameTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { Box, Button, Input, FilterPill, InlineFieldRow, InlineField, InlineSwitch, Select } from '@grafana/ui';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FieldNameInfo {
  name: string;
  count: number;
}

/** Every distinct field display name across the input frames, with how many frames it appears in. */
function getFieldNameInfos(input: DataFrame[]): FieldNameInfo[] {
  const allNames: FieldNameInfo[] = [];
  const byName: KeyValue<FieldNameInfo> = {};

  for (const frame of input) {
    for (const field of frame.fields) {
      const displayName = getFieldDisplayName(field, frame, input);
      let v = byName[displayName];

      if (!v) {
        v = byName[displayName] = {
          name: displayName,
          count: 0,
        };
        allNames.push(v);
      }

      v.count++;
    }
  }

  return allNames;
}

/** The field names the given options select. With nothing configured, everything is selected. */
function getSelectedNames(fieldNames: FieldNameInfo[], options: FilterFieldsByNameTransformerOptions): string[] {
  const configuredOptions = Array.from(options.include?.names ?? []);

  if (options.include?.pattern) {
    try {
      const regex = stringToJsRegex(options.include.pattern);

      for (const info of fieldNames) {
        if (regex.test(info.name)) {
          configuredOptions.push(info.name);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (configuredOptions.length) {
    return fieldNames.filter((n) => configuredOptions.includes(n.name)).map((s) => s.name);
  }

  return fieldNames.map((n) => n.name);
}

export function FilterByNameTransformerEditor({ input, options, onChange }: FilterByNameTransformerEditorProps) {
  const fieldNames = useMemo(() => getFieldNameInfos(input), [input]);
  const [selected, setSelected] = useState<string[]>(() => getSelectedNames(fieldNames, options));
  const [regex, setRegex] = useState(options.include?.pattern);
  const [variable, setVariable] = useState(options.include?.variable);
  const [byVariable, setByVariable] = useState(options.byVariable || false);
  const [isRegexValid, setIsRegexValid] = useState(true);

  const variables: SelectableValue[] = useMemo(
    () =>
      getTemplateSrv()
        .getVariables()
        .map((v) => ({ label: '$' + v.name, value: '$' + v.name })),
    []
  );

  // Key on the names, not the input: upstream transformations send a new input array on every
  // options change. Sorted so a reorder alone does not count as new names.
  const fieldNamesKey = JSON.stringify(fieldNames.map((n) => n.name).sort());
  const optionsKey = JSON.stringify(options);

  // The options this editor last sent. When they come back, local state already matches them, and
  // resetting would turn "no fields selected" (saved as an empty include) back into "all fields selected".
  const [sentOptionsKey, setSentOptionsKey] = useState<string>();
  const sendOptions = (nextOptions: FilterFieldsByNameTransformerOptions) => {
    setSentOptionsKey(JSON.stringify(nextOptions));
    onChange(nextOptions);
  };

  // New field names reset the state. So do options this editor did not send, such as another
  // transformation's after the list is reordered: the panel editor keys rows by position, so this
  // instance stays mounted. The regex only resets when its saved pattern changes, so an unrelated
  // options change keeps an in-progress regex that is not yet valid.
  const [prev, setPrev] = useState({ fieldNamesKey, optionsKey, pattern: options.include?.pattern });
  if (prev.fieldNamesKey !== fieldNamesKey || prev.optionsKey !== optionsKey) {
    const isNewFieldNames = prev.fieldNamesKey !== fieldNamesKey;
    const isNewOptions = prev.optionsKey !== optionsKey && optionsKey !== sentOptionsKey;

    setPrev({ fieldNamesKey, optionsKey, pattern: options.include?.pattern });
    if (prev.optionsKey !== optionsKey) {
      setSentOptionsKey(undefined);
    }

    if (isNewFieldNames || isNewOptions) {
      setSelected(getSelectedNames(fieldNames, options));
      setByVariable(options.byVariable || false);
      setVariable(options.include?.variable);
    }
    if (isNewFieldNames || (isNewOptions && prev.pattern !== options.include?.pattern)) {
      setRegex(options.include?.pattern);
    }
  }

  const onSelectionChange = (nextSelected: string[]) => {
    const nextOptions: FilterFieldsByNameTransformerOptions = {
      ...options,
      include: { names: nextSelected },
    };

    if (regex && isRegexValid) {
      nextOptions.include = nextOptions.include ?? {};
      nextOptions.include.pattern = regex;
    }

    setSelected(nextSelected);
    sendOptions(nextOptions);
  };

  // An empty include keeps every field, including ones that appear later, so both "Select all" and
  // "Deselect all" save it: the transformer has no way to show no fields. The pattern is cleared too,
  // otherwise only the fields it matches would pass.
  const onResetSelection = (nextSelected: string[]) => {
    setRegex(undefined);
    setIsRegexValid(true);
    setSelected(nextSelected);
    sendOptions({ ...options, include: { names: [] } });
  };

  const onFieldToggle = (fieldName: string) => {
    if (selected.indexOf(fieldName) > -1) {
      onSelectionChange(selected.filter((s) => s !== fieldName));
    } else {
      onSelectionChange([...selected, fieldName]);
    }
  };

  const onInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    let nextIsRegexValid = true;

    try {
      if (regex) {
        stringToJsRegex(regex);
      }
    } catch (e) {
      nextIsRegexValid = false;
    }

    if (nextIsRegexValid) {
      sendOptions({
        ...options,
        include: { pattern: regex },
      });
    } else {
      sendOptions({
        ...options,
        include: { names: selected },
      });
    }

    setIsRegexValid(nextIsRegexValid);
  };

  const onVariableChange = (nextSelected: SelectableValue) => {
    sendOptions({
      ...options,
      include: { variable: nextSelected.value },
    });

    setVariable(nextSelected.value);
  };

  const onFromVariableChange = (e: FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.checked;
    sendOptions({ ...options, byVariable: val });
    setByVariable(val);
  };

  return (
    <div>
      <InlineFieldRow label={t('transformers.filter-by-name-transformer-editor.label-use-variable', 'Use variable')}>
        <InlineField label={t('transformers.filter-by-name-transformer-editor.label-from-variable', 'From variable')}>
          <InlineSwitch value={byVariable} onChange={onFromVariableChange}></InlineSwitch>
        </InlineField>
      </InlineFieldRow>
      {byVariable ? (
        <InlineFieldRow>
          <InlineField label={t('transformers.filter-by-name-transformer-editor.label-variable', 'Variable')}>
            <Select value={variable} onChange={onVariableChange} options={variables || []}></Select>
          </InlineField>
        </InlineFieldRow>
      ) : (
        <InlineFieldRow label={t('transformers.filter-by-name-transformer-editor.label-identifier', 'Identifier')}>
          <InlineField
            label={t('transformers.filter-by-name-transformer-editor.label-identifier', 'Identifier')}
            invalid={!isRegexValid}
            error={!isRegexValid ? 'Invalid pattern' : undefined}
          >
            <Input
              placeholder={t(
                'transformers.filter-by-name-transformer-editor.placeholder-regular-expression-pattern',
                'Regular expression pattern'
              )}
              value={regex || ''}
              onChange={(e) => setRegex(e.currentTarget.value)}
              onBlur={onInputBlur}
              width={25}
            />
          </InlineField>
          <Box display="flex" gap={0.5} marginRight={0.5}>
            <Button variant="secondary" onClick={() => onResetSelection(fieldNames.map((n) => n.name))}>
              {t('transformers.filter-by-name-transformer-editor.select-all', 'Select all')}
            </Button>
            <Button variant="secondary" onClick={() => onResetSelection([])}>
              {t('transformers.filter-by-name-transformer-editor.deselect-all', 'Deselect all')}
            </Button>
          </Box>
          {fieldNames.map((o, i) => {
            const label = `${o.name}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
            const isSelected = selected.indexOf(o.name) > -1;
            return (
              <FilterPill
                key={`${o.name}/${i}`}
                onClick={() => {
                  onFieldToggle(o.name);
                }}
                label={label}
                selected={isSelected}
              />
            );
          })}
        </InlineFieldRow>
      )}
    </div>
  );
}
