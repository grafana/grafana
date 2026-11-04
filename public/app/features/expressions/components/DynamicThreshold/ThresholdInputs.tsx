import { type FormEvent } from 'react';

import { Input, Stack } from '@grafana/ui';

import { ToLabel } from '../ToLabel';

interface Props {
  thresholds: Array<number | undefined>;
  thresholdCount: number;
  getAriaLabel: (thresholdIndex: number) => string;
  onChange: (thresholds: Array<number | undefined>) => void;
}

export function ThresholdInputs({ thresholds, thresholdCount, getAriaLabel, onChange }: Props) {
  const update = (index: number, event: FormEvent<HTMLInputElement>) => {
    const next = [...thresholds];
    const value = event.currentTarget.value;
    next[index] = value === '' ? undefined : Number(value);
    onChange(next);
  };

  return (
    <Stack direction="row" gap={0}>
      {Array.from({ length: thresholdCount }, (_, index) => (
        <Stack key={index} direction="row" gap={0}>
          {index > 0 && <ToLabel />}
          <Input
            type="number"
            width={10}
            aria-label={getAriaLabel(index)}
            value={thresholds[index] ?? ''}
            onChange={(event) => update(index, event)}
          />
        </Stack>
      ))}
    </Stack>
  );
}
