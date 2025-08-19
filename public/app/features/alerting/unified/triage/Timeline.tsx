import { scaleUtc } from 'd3-scale';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { Stack, Text } from '@grafana/ui';

import { Domain } from './types';

interface TimelineProps {
  domain: Domain;
}

export const TimelineHeader = ({ domain }: TimelineProps) => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const ticks = useMemo(() => {
    const xScale = scaleUtc().domain(domain).range([0, width]).nice(0);
    const tickFormatter = xScale.tickFormat();

    return xScale.ticks(5).map((value) => ({
      value: tickFormatter(value),
      xOffset: xScale(value),
    }));
  }, [domain, width]);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <Stack flex={1} direction="row" justifyContent="space-between">
        {ticks.map((tick) => (
          <Text variant="bodySmall" color="secondary">
            {tick.value}
          </Text>
        ))}
      </Stack>
    </div>
  );
};
