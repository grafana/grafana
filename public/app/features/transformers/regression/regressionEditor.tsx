import React from 'react';

import { DataTransformerID, TransformerRegistryItem, TransformerUIProps, TransformerCategory } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import { useAllFieldNamesFromDataFrames } from '../utils';

import { ModelType, RegressionTransformer, RegressionTransformerOptions } from './regression';

export const RegressionTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<RegressionTransformerOptions>) => {
  const modelTypeOptions = [
    { label: 'Linear', value: ModelType.linear },
    { label: 'Polynomial', value: ModelType.polynomial },
  ];

  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  return (
    <>
      <InlineField label="x field">
        <Select
          options={fieldNames}
          value={options.xFieldName}
          onChange={(v) => {
            onChange({ ...options, xFieldName: v.value });
          }}
        ></Select>
      </InlineField>
      <InlineField label="y field">
        <Select
          options={fieldNames}
          value={options.yFieldName}
          onChange={(v) => {
            onChange({ ...options, yFieldName: v.value });
          }}
        ></Select>
      </InlineField>
      <InlineField label="Model type">
        <Select
          value={options.modelType}
          onChange={(v) => {
            onChange({ ...options, modelType: v.value ?? ModelType.linear });
          }}
          options={modelTypeOptions}
        ></Select>
      </InlineField>
      <InlineField label="Precision">
        <NumberInput
          value={options.precision}
          onChange={(v) => {
            onChange({ ...options, precision: v });
          }}
        ></NumberInput>
      </InlineField>
      {options.modelType === ModelType.polynomial && (
        <InlineField label="Order">
          <NumberInput
            value={options.order}
            onChange={(v) => {
              onChange({ ...options, order: v });
            }}
          ></NumberInput>
        </InlineField>
      )}
    </>
  );
};

export const regressionTransformerRegistryItem: TransformerRegistryItem<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  editor: RegressionTransformerEditor,
  transformation: RegressionTransformer,
  name: RegressionTransformer.name,
  description: RegressionTransformer.description,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(DataTransformerID.merge).helperDocs,
};
