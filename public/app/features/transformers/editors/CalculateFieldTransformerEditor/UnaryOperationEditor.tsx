import React from 'react';

import { unaryOperators, SelectableValue, UnaryOperationID } from '@grafana/data';
import {
  UnaryOptions,
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const UnaryOperationEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { unary } = options;

  const updateUnaryOptions = (v: UnaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.UnaryOperation,
      unary: v,
    });
  };

  const prqlString = (v: SelectableValue<UnaryOperationID>) => {
    console.log('v', v);
    switch (v.label) {
      // TODO: For each of the below cases
      // Namespace the column in the table?
      // ie. something like `ref_A.up`
      case UnaryOperationID.Abs:
        return `
          derive abs(up) = case [
            up >= 0 => up,
            up < 0 => -up,
          ]
        `;
      case UnaryOperationID.Exp:
        // Use the S-String "escape hatch" feature of PRQL
        // and the `EXP()` function within DuckDB
        // TODO: Namespace the column in the table?
        // ie. something like `EXP({ref_A.up})`
        return `
          derive exp(up) = s"EXP({up})"
        `;
      case UnaryOperationID.Ln:
        // Use the S-String "escape hatch" feature of PRQL
        // and the `LN()` function within DuckDB
        return `
          derive ln(up) = s"LN({up})"
        `;
      case UnaryOperationID.Floor:
        // Use the S-String "escape hatch" feature of PRQL
        // and the `FLOOR()` function within DuckDB
        return `
          derive floor(up) = s"FLOOR({up})"
        `;
      case UnaryOperationID.Ceil:
        // Use the S-String "escape hatch" feature of PRQL
        // and the `CEIL()` function within DuckDB
        return `
          derive ceil(up) = s"CEIL({up})"
        `;
    }
    // Typescript was complaining that "Not all code paths return a value."
    return "didn't work";
  };

  const onUnaryOperationChanged = (v: SelectableValue<UnaryOperationID>) => {
    updateUnaryOptions({
      ...unary!,
      operator: v.value!,
      prql: prqlString(v),
    });
  };

  const onUnaryValueChanged = (v: SelectableValue<string>) => {
    updateUnaryOptions({
      ...unary!,
      fieldName: v.value!,
    });
  };

  let found = !unary?.fieldName;
  const names = props.names.map((v) => {
    if (v === unary?.fieldName) {
      found = true;
    }
    return { label: v, value: v };
  });

  const ops = unaryOperators.list().map((v) => {
    return { label: v.unaryOperationID, value: v.unaryOperationID };
  });

  const fieldName = found ? names : [...names, { label: unary?.fieldName, value: unary?.fieldName }];

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={LABEL_WIDTH}>
          {/* When the "Operation" changes, update the PRQL */}
          <Select options={ops} value={unary?.operator ?? ops[0].value} onChange={onUnaryOperationChanged} />
        </InlineField>
        <InlineField label="(" labelWidth={2}>
          {/* TODO: When the "Field" changes, ALSO update the PRQL */}
          <Select
            placeholder="Field"
            className="min-width-11"
            options={fieldName}
            value={unary?.fieldName}
            onChange={onUnaryValueChanged}
          />
        </InlineField>
        <InlineLabel width={2}>)</InlineLabel>
      </InlineFieldRow>
    </>
  );
};
