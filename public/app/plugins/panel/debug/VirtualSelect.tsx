import { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { VirtualizedSelect } from '@grafana/ui';

interface Props {
  data: SelectableValue[];
}

export const VirtualSelect = ({ data }: Props) => {
  const [value, setValue] = useState<SelectableValue>();
  const [options, setOptions] = useState<SelectableValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
    setOptions(data);
  }, [data]);

  return <VirtualizedSelect value={value} onChange={setValue} options={options} isLoading={isLoading} />;
};
