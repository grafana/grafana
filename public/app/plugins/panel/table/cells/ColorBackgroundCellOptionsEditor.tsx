import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BackgroundDisplayMode } from '@grafana/schema';
import { HorizontalGroup, Select, Field } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const colorBackgroundOpts: SelectableValue[] = [
  { value: BackgroundDisplayMode.Basic, label: 'Basic' },
  { value: BackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor: React.FC<TableCellEditorProps> = ({
  subOptions,
  onSubOptionsChange,
}) => {
  // When the select changes we build an options
  // object as needed and set the display mode
  const onChange = (v: SelectableValue) => {
    if (subOptions === undefined) {
      subOptions = {};
    }

    subOptions.displayMode = v.value;
    onSubOptionsChange(subOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select value={subOptions?.displayMode} onChange={onChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
