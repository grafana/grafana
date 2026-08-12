import { useMemo, useCallback, type FormEvent } from 'react';

import {
  FieldMatcherID,
  fieldMatchers,
  type FieldValueMatcherConfig,
  fieldReducers,
  ReducerID,
  type SelectableValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { ComparisonOperation } from '@grafana/schema';

import { Combobox } from '../Combobox/Combobox';
import { type ComboboxOption } from '../Combobox/types';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { type MatcherUIProps, type FieldMatcherUIRegistryItem } from './types';

type Props = MatcherUIProps<FieldValueMatcherConfig>;

const toComboboxOption = <T extends string | number>(
  value: SelectableValue<string | number | T>
): ComboboxOption<T> => ({
  label: value.label,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  value: value.value! as T,
  description: value.description,
});

export const comparisonOperationOptions = [
  { label: '==', value: ComparisonOperation.EQ },
  { label: '!=', value: ComparisonOperation.NEQ },
  { label: '>', value: ComparisonOperation.GT },
  { label: '>=', value: ComparisonOperation.GTE },
  { label: '<', value: ComparisonOperation.LT },
  { label: '<=', value: ComparisonOperation.LTE },
];

// This should move to a utility function on the reducer registry
function isBooleanReducer(r: ReducerID) {
  return r === ReducerID.allIsNull || r === ReducerID.allIsZero;
}

export const FieldValueMatcherEditor = ({ id, options, onChange }: Props) => {
  const reducer = useMemo(() => fieldReducers.selectOptions([options?.reducer]), [options?.reducer]);

  const onSetReducer = useCallback(
    (selection: ComboboxOption<ReducerID>) => {
      return onChange({ ...options, reducer: selection.value });
    },
    [options, onChange]
  );

  const onChangeOp = useCallback(
    (v: SelectableValue<ComparisonOperation>) => {
      return onChange({ ...options, op: v.value! });
    },
    [options, onChange]
  );

  const onChangeValue = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      const value = e.currentTarget.valueAsNumber;
      return onChange({ ...options, value });
    },
    [options, onChange]
  );

  const opts = options ?? {};
  const isBool = isBooleanReducer(opts.reducer);

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={0.5}>
        <Combobox<ReducerID>
          id={id}
          value={toComboboxOption<ReducerID>(reducer.current[0])}
          options={reducer.options.map((o) => toComboboxOption<ReducerID>(o))}
          onChange={onSetReducer}
          placeholder={t('grafana-ui.field-value-matcher.select-field-placeholder', 'Select field reducer')}
        />
        {opts.reducer && !isBool && (
          <>
            <Combobox
              value={comparisonOperationOptions.find((v) => v.value === opts.op)}
              options={comparisonOperationOptions}
              onChange={onChangeOp}
              aria-label={t('grafana-ui.field-value-matcher.operator-label', 'Comparison operator')}
              width={19}
            />

            <Input
              type="number"
              value={opts.value}
              onChange={onChangeValue}
              aria-label={t('grafana-ui.field-value-matcher.reducer-value-label', 'Reducer value')}
            />
          </>
        )}
      </Stack>
    </Stack>
  );
};

export const getFieldValueMatcherItem: () => FieldMatcherUIRegistryItem<FieldValueMatcherConfig> = () => ({
  id: FieldMatcherID.byValue,
  component: FieldValueMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byValue),
  name: t('grafana-ui.matchers-ui.name-fields-with-value', 'Fields with values'),
  description: t(
    'grafana-ui.matchers-ui.description-fields-with-value',
    'Set properties for fields with reducer condition'
  ),
  optionsToLabel: (options) => `${options?.reducer} ${options?.op} ${options?.value}`,
});
