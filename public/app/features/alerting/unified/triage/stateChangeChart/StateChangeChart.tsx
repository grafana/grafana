import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { Domain } from '../types';

import { createStateRectangles, processTimelineData } from './utils';

interface StateChartProps {
  domain: Domain;
  timeline?: Array<[timestamp: string | number, 'firing' | 'pending']>;
}

const TIMELINE_HEIGHT = 15;

export function StateChangeChart({ domain, timeline = [] }: StateChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const stateRectangles = useMemo(() => {
    if (!width) {
      return [];
    }

    const processedData = processTimelineData(timeline);
    return createStateRectangles(processedData, domain, width);
  }, [domain, width, timeline]);

  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden' }}>
      <svg width="100%" height={TIMELINE_HEIGHT} viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`} preserveAspectRatio="none">
        {stateRectangles.map((rect) => (
          <rect key={rect.x} x={rect.x} width={rect.width} height={TIMELINE_HEIGHT} fill={rect.color} />
        ))}
      </svg>
    </div>
  );
}
