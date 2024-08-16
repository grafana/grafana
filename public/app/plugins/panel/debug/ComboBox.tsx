import { useEffect, useState } from 'react';

import { Combobox } from '@grafana/ui';

// copied from Combobox
type Value = string | number;
type Option = {
  label: string;
  value: Value;
  description?: string;
};

interface Props {
  data: Option[];
}

export const ComboBox = ({ data }: Props) => {
  const [value, setValue] = useState<Value | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
    setOptions(data);
    // setValue(options[5].value);
  }, [data]);

  return (
    <Combobox
      loading={isLoading}
      options={options}
      value={value}
      onChange={(val) => {
        setValue(val?.value || null);
      }}
    />
  );
};
