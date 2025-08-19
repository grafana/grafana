import { scaleUtc } from 'd3';
import { subMinutes } from 'date-fns';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { config } from '@grafana/runtime';

import { Domain } from './types';

interface StateChartProps {
  domain: Domain;
}

const { colors } = config.theme2;
const timelineHeight = 15;

type state = 'firing' | 'pending' | 'normal';

const STATE_COLORS: Record<state, string> = {
  firing: colors.error.main,
  pending: colors.warning.main,
  normal: colors.success.main,
};

// @TODO dont' use fake data
const DATA: Array<{ time: Date; state: keyof typeof STATE_COLORS }> = [
  {
    time: subMinutes(new Date(), 60),
    state: 'normal',
  },
  {
    time: subMinutes(new Date(), 45),
    state: 'pending',
  },
  {
    time: subMinutes(new Date(), 30),
    state: 'firing',
  },
  {
    time: subMinutes(new Date(), 15),
    state: 'normal',
  },
];

interface StateRectangle {
  x: number;
  width: number;
  state: keyof typeof STATE_COLORS;
  color: string;
}

export function StateChangeChart({ domain }: StateChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const stateRectangles = useMemo(() => {
    if (!width) {
      return [];
    }

    const xScale = scaleUtc().domain(domain).range([0, width]).nice(0);

    // Create rectangles for each state change
    const rectangles: StateRectangle[] = [];
    for (let i = 0; i < DATA.length - 1; i++) {
      const current = DATA[i];
      const next = DATA[i + 1];

      rectangles.push({
        x: xScale(current.time),
        width: xScale(next.time) - xScale(current.time),
        state: current.state,
        color: STATE_COLORS[current.state],
      });
    }

    // Add the last state extending to the end of the domain
    if (DATA.length > 0) {
      const lastState = DATA[DATA.length - 1];
      rectangles.push({
        x: xScale(lastState.time),
        width: xScale(domain[1]) - xScale(lastState.time),
        state: lastState.state,
        color: STATE_COLORS[lastState.state],
      });
    }

    return rectangles;
  }, [domain, width]);

  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden' }}>
      {/* State Timeline */}
      <div style={{ position: 'relative', height: timelineHeight }}>
        <svg width="100%" height={timelineHeight} viewBox={`0 0 ${width} ${timelineHeight}`} preserveAspectRatio="none">
          {stateRectangles.map((rect, index) => (
            <rect key={index} x={rect.x} width={rect.width} height={timelineHeight} fill={rect.color} />
          ))}
        </svg>
      </div>
    </div>
  );
}
