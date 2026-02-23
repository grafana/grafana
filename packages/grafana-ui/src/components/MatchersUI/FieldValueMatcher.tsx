import { css } from '@emotion/css';
import { useMemo, useCallback } from 'react';
import * as React from 'react';

import {
  FieldMatcherID,
  fieldMatchers,
  FieldValueMatcherConfig,
  fieldReducers,
  ReducerID,
  SelectableValue,
  GrafanaTheme2,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { ComparisonOperation } from '@grafana/schema';

import { useStyles2 } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';

type Props = MatcherUIProps<FieldValueMatcherConfig>;

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

export const FieldValueMatcherEditor = ({ options, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const reducer = useMemo(() => fieldReducers.selectOptions([options?.reducer]), [options?.reducer]);

  const onSetReducer = useCallback(
    (selection: SelectableValue<string>) => {
      return onChange({ ...options, reducer: selection.value! as ReducerID });
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
    (e: React.FormEvent<HTMLInputElement>) => {
      const value = e.currentTarget.valueAsNumber;
      return onChange({ ...options, value });
    },
    [options, onChange]
  );

  const opts = options ?? {};
  const isBool = isBooleanReducer(opts.reducer);

  return (
    <div className={styles.spot}>
      <Select
        value={reducer.current}
        options={reducer.options}
        onChange={onSetReducer}
        placeholder={t('grafana-ui.field-value-matcher.select-field-placeholder', 'Select field reducer')}
      />
      {opts.reducer && !isBool && (
        <>
          <Select
            value={comparisonOperationOptions.find((v) => v.value === opts.op)}
            options={comparisonOperationOptions}
            onChange={onChangeOp}
            aria-label={t('grafana-ui.field-value-matcher.operator-label', 'Comparison operator')}
            width={19}
          />

          <Input type="number" value={opts.value} onChange={onChangeValue} />
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spot: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      alignContent: 'flex-end',
      gap: '4px',
    }),
  };
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
