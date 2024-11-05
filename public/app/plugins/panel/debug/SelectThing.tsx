import { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

interface Props {
  data: SelectableValue[];
}

export const SelectThing = ({ data }: Props) => {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Select
      value={value}
      options={data}
      width="auto"
      onChange={(change) => {
        setValue(change.value ?? null);
      }}
    />
  );
};
