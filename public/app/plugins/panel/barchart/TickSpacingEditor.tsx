import React from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { Checkbox, HorizontalGroup, RadioButtonGroup, Tooltip } from '@grafana/ui';

const GAPS_OPTIONS: Array<SelectableValue<number>> = [
  {
    label: 'None',
    value: 0,
    description: 'Show all tick marks',
  },
  {
    label: 'Small',
    value: 100,
    description: 'Require 100px spacing',
  },
  {
    label: 'Medium',
    value: 200,
    description: 'Require 200px spacing',
  },
  {
    label: 'Large',
    value: 300,
    description: 'Require 300px spacing',
  },
];

export const TickSpacingEditor = (props: StandardEditorProps<number>) => {
  let value = props.value ?? 0;
  const isRTL = value < 0;
  if (isRTL) {
    value *= -1;
  }
  let gap = GAPS_OPTIONS[0];
  for (const v of GAPS_OPTIONS) {
    gap = v;
    if (value <= gap.value!) {
      break;
    }
  }

  const onSpacingChange = (val: number) => {
    props.onChange(val * (isRTL ? -1 : 1));
  };

  const onRTLChange = () => {
    props.onChange(props.value * -1);
  };

  return (
    <HorizontalGroup>
      <RadioButtonGroup value={gap.value} options={GAPS_OPTIONS} onChange={onSpacingChange} />
      {value !== 0 && (
        <Tooltip content="Require space from the right side" placement="top">
          <div>
            <Checkbox value={isRTL} onChange={onRTLChange} label="RTL" />
          </div>
        </Tooltip>
      )}
    </HorizontalGroup>
  );
};
