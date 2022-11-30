import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BackgroundDisplayMode } from '@grafana/schema';
import { HorizontalGroup, Select, Field } from '@grafana/ui';

const colorBackgroundOpts: SelectableValue[] = [
  { value: BackgroundDisplayMode.Basic, label: 'Basic' },
  { value: BackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptions: React.FC = (props) => {
  const onChange = () => {};

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select onChange={onChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
