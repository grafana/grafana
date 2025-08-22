import { scaleUtc } from 'd3';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { config } from '@grafana/runtime';

import { Domain } from './types';

interface StateChartProps {
  domain: Domain;
  timeline?: Array<[timestamp: string | number, 'firing' | 'pending']>;
}

const { colors } = config.theme2;

type state = 'firing' | 'pending' | 'normal';

const STATE_COLORS: Record<state, string> = {
  firing: colors.error.main,
  pending: colors.warning.main,
  normal: colors.success.main,
};

interface StateRectangle {
  x: number;
  width: number;
  state: keyof typeof STATE_COLORS;
  color: string;
}

const TIMELINE_HEIGHT = 15;

export function StateChangeChart({ domain, timeline = [] }: StateChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const stateRectangles = useMemo(() => {
    if (!width) {
      return [];
    }

    // Use timeline data if provided, otherwise fall back to fake DATA
    let data = timeline.map(([timestamp, state]) => ({
      time: new Date(timestamp),
      state: state as keyof typeof STATE_COLORS,
    }));

    // Fill gaps in timeline data with 'normal' state
    if (timeline && timeline.length > 1) {
      const filledData: Array<{ time: Date; state: keyof typeof STATE_COLORS }> = [];

      // Sort data by time to ensure proper ordering
      data.sort((a, b) => a.time.getTime() - b.time.getTime());

      for (let i = 0; i < data.length; i++) {
        const current = data[i];
        filledData.push(current);

        // Check if there's a next data point and if there's a gap
        if (i < data.length - 1) {
          const next = data[i + 1];
          const currentTime = current.time.getTime();
          const nextTime = next.time.getTime();
          const minuteDiff = (nextTime - currentTime) / (1000 * 60); // difference in minutes

          // If gap is more than 1 minute, fill with 'normal' states
          if (minuteDiff > 1) {
            for (let minute = 1; minute < minuteDiff; minute++) {
              filledData.push({
                time: new Date(currentTime + minute * 60 * 1000),
                state: 'normal',
              });
            }
          }
        }
      }

      data = filledData;
    }

    const xScale = scaleUtc().domain(domain).range([0, width]);

    const rectangles: StateRectangle[] = [];
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];

      rectangles.push({
        x: xScale(current.time),
        width: xScale(next.time) - xScale(current.time),
        state: current.state,
        color: STATE_COLORS[current.state],
      });
    }

    // Add the last state extending to the end of the domain
    if (data.length > 0) {
      const lastState = data[data.length - 1];
      rectangles.push({
        x: xScale(lastState.time),
        width: xScale(domain[1]) - xScale(lastState.time),
        state: lastState.state,
        color: STATE_COLORS[lastState.state],
      });
    }

    return rectangles;
  }, [domain, width, timeline]);

  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden' }}>
      <svg width="100%" height={TIMELINE_HEIGHT} viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`} preserveAspectRatio="none">
        {stateRectangles.map((rect, index) => (
          <rect key={index} x={rect.x} width={rect.width} height={TIMELINE_HEIGHT} fill={rect.color} />
        ))}
      </svg>
    </div>
  );
}
