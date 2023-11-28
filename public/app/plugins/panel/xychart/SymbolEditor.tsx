import React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';
import { RadioButtonGroup } from '@grafana/ui';
import { ResourceDimensionOptions } from 'app/features/dimensions';

export const SymbolEditor = (
  props: StandardEditorProps<ResourceDimensionConfig, ResourceDimensionOptions, unknown>
) => {
  const { value } = props;

  const basicSymbols = [
    { value: 'img/icons/marker/circle.svg', label: 'Circle' },
    { value: 'img/icons/marker/square.svg', label: 'Square' },
  ];

  const onSymbolChange = (v: string) => {
    props.onChange({
      fixed: v,
      mode: ResourceDimensionMode.Fixed,
    });
  };

  return (
    <div>
      <RadioButtonGroup options={basicSymbols} value={value.fixed} onChange={onSymbolChange} />
      {!basicSymbols.find((v) => v.value === value.fixed) && <div>{value.fixed}</div>}
    </div>
  );
};
