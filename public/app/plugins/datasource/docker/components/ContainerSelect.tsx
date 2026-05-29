import { useEffect, useState } from 'react';
import { AsyncSelect, Stack } from '@grafana/ui';
import type { SelectableValue } from '@grafana/data';

export interface ContainerOption extends SelectableValue<string> {
  label: string;
  value: string;
}

interface Props {
  value?: string;
  onChange: (containerId: string) => void;
  loadOptions: () => Promise<ContainerOption[]>;
}

export function ContainerSelect({ value, onChange, loadOptions }: Props) {
  const [options, setOptions] = useState<ContainerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const result = await loadOptions();
        setOptions(result);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [loadOptions]);

  return (
    <Stack direction="column" gap={1}>
      <AsyncSelect
        allowCustomValue
        isLoading={loading}
        defaultOptions={options}
        options={options}
        value={
          value ? { label: value, value } : null}
        loadOptions={async () => options}
        onChange={(v) => onChange(v?.value ?? '')}
        placeholder="Select container"
      />
    </Stack>
  );
}
