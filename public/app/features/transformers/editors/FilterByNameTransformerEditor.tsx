import { useEffect, useEffectEvent, useMemo, useState, type FocusEvent, type FormEvent } from 'react';

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
import { Input, FilterPill, InlineFieldRow, InlineField, InlineSwitch, Select } from '@grafana/ui';

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

  // Read at the point the effect below runs rather than subscribing to it: re-seeding whenever
  // the options change would discard in-progress edits, such as a regex that is not yet valid.
  const latestOptions = useEffectEvent(() => options);

  // New input frames mean new field names, so the selection has to be derived again.
  useEffect(() => {
    const seedOptions = latestOptions();

    setSelected(getSelectedNames(fieldNames, seedOptions));
    setByVariable(seedOptions.byVariable || false);
    setVariable(seedOptions.include?.variable);
    setRegex(seedOptions.include?.pattern);
    // eslint-plugin-react-hooks only recognises effect events from 7.1.1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldNames]);

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
    onChange(nextOptions);
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
      onChange({
        ...options,
        include: { pattern: regex },
      });
    } else {
      onChange({
        ...options,
        include: { names: selected },
      });
    }

    setIsRegexValid(nextIsRegexValid);
  };

  const onVariableChange = (nextSelected: SelectableValue) => {
    onChange({
      ...options,
      include: { variable: nextSelected.value },
    });

    setVariable(nextSelected.value);
  };

  const onFromVariableChange = (e: FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.checked;
    onChange({ ...options, byVariable: val });
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
