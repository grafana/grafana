import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (item: SelectableValue<string>) => void;
  disabled?: boolean;
}

const options = ['=', '!=', '<', '>', '=~', '!~'].map<SelectableValue<string>>((value) => ({
  label: value,
  value,
}));

export const OperatorSegment: FC<Props> = ({ value, disabled, onChange }) => {
  return (
    <Segment
      className="query-segment-operator"
      value={value}
      disabled={disabled}
      options={options}
      onChange={onChange}
    />
  );
};
