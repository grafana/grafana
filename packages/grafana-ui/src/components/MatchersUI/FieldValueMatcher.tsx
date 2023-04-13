import { css } from '@emotion/css';
import React, { useMemo, useCallback } from 'react';

import {
  FieldMatcherID,
  fieldMatchers,
  FieldValueMatcherConfig,
  fieldReducers,
  ReducerID,
  SelectableValue,
  GrafanaTheme2,
} from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';

import { useStyles2 } from '../../themes';
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
  const isBool = isBooleanReducer(options.reducer);

  return (
    <div className={styles.spot}>
      <Select
        value={reducer.current}
        options={reducer.options}
        onChange={onSetReducer}
        placeholder="Select field reducer"
      />
      {opts.reducer && !isBool && (
        <>
          <Select
            value={comparisonOperationOptions.find((v) => v.value === opts.op)}
            options={comparisonOperationOptions}
            onChange={onChangeOp}
            aria-label={'Comparison operator'}
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
    spot: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      align-content: flex-end;
      gap: 4px;
    `,
  };
};

export const fieldValueMatcherItem: FieldMatcherUIRegistryItem<FieldValueMatcherConfig> = {
  id: FieldMatcherID.byValue,
  component: FieldValueMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byValue),
  name: 'Fields with values',
  description: 'Set properties for fields with reducer condition',
  optionsToLabel: (options) => `${options?.reducer} ${options?.op} ${options?.value}`,
};
