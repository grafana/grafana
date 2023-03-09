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

export const comparators = [
  { label: '==', value: ComparisonOperation.EQ },
  { label: '!=', value: ComparisonOperation.NEQ },
  { label: '>', value: ComparisonOperation.GT },
  { label: '>=', value: ComparisonOperation.GTE },
  { label: '<', value: ComparisonOperation.LT },
  { label: '<=', value: ComparisonOperation.LTE },
];

export const FieldValuesMatcherEditor = ({ options, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const reducer = useMemo(() => fieldReducers.selectOptions([options?.reduce]), [options?.reduce]);

  const onSetReducer = useCallback(
    (selection: SelectableValue<string>) => {
      return onChange({ ...options, reduce: selection.value! as any });
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
  const isBool = opts.reduce === ReducerID.allIsNull || opts.reduce === ReducerID.allIsZero;

  return (
    <div className={styles.spot}>
      <Select
        value={reducer.current}
        options={reducer.options}
        onChange={onSetReducer}
        placeholder="Select field reducer"
      />
      {opts.reduce && !isBool && (
        <>
          <Select
            value={comparators.find((v) => v.value === opts.op)}
            options={comparators}
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
    `,
    // colorPicker: css`
    //   padding: 0 ${theme.spacing(1)};
    // `,
    // colorText: css`
    //   flex-grow: 2;
    // `,
    // placeholderText: css`
    //   flex-grow: 2;
    //   color: ${theme.colors.text.secondary};
    // `,
  };
};

export const fieldValuesMatcherItem: FieldMatcherUIRegistryItem<FieldValueMatcherConfig> = {
  id: FieldMatcherID.byValues,
  component: FieldValuesMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byValues),
  name: 'Fields with values',
  description: 'Set properties for fields with reducer condition',
  optionsToLabel: (options) => `${options?.reduce} ${options?.op} ${options?.value}`,
};
