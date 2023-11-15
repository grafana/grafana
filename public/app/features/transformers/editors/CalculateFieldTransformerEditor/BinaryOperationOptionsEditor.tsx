import React from 'react';

import { BinaryOperationID, binaryOperators, SelectableValue } from '@grafana/data';
import {
  BinaryOptions,
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const BinaryOperationOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  onChange: (options: CalculateFieldTransformerOptions) => void;
  names: string[];
}) => {
  const { options, onChange } = props;
  const { binary } = options;

  let foundLeft = !binary?.left;
  let foundRight = !binary?.right;
  const names = props.names.map((v) => {
    if (v === binary?.left) {
      foundLeft = true;
    }
    if (v === binary?.right) {
      foundRight = true;
    }
    return { label: v, value: v };
  });
  const leftNames = foundLeft ? names : [...names, { label: binary?.left, value: binary?.left }];
  const rightNames = foundRight ? names : [...names, { label: binary?.right, value: binary?.right }];

  const ops = binaryOperators.list().map((v) => {
    return { label: v.binaryOperationID, value: v.binaryOperationID };
  });

  const updateBinaryOptions = (v: BinaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.BinaryOperation,
      binary: v,
    });
  };

  const onBinaryLeftChanged = (v: SelectableValue<string>) => {
    updateBinaryOptions({
      ...binary!,
      left: v.value!,
    });
  };

  const onBinaryRightChanged = (v: SelectableValue<string>) => {
    updateBinaryOptions({
      ...binary!,
      right: v.value!,
    });
  };

  const onBinaryOperationChanged = (v: SelectableValue<BinaryOperationID>) => {
    updateBinaryOptions({
      ...binary!,
      operator: v.value!,
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={LABEL_WIDTH}>
          <Select
            allowCustomValue={true}
            placeholder="Field or number"
            options={leftNames}
            className="min-width-18"
            value={binary?.left}
            onChange={onBinaryLeftChanged}
          />
        </InlineField>
        <InlineField>
          <Select
            className="width-4"
            options={ops}
            value={binary?.operator ?? ops[0].value}
            onChange={onBinaryOperationChanged}
          />
        </InlineField>
        <InlineField>
          <Select
            allowCustomValue={true}
            placeholder="Field or number"
            className="min-width-10"
            options={rightNames}
            value={binary?.right}
            onChange={onBinaryRightChanged}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
