import { scaleUtc } from 'd3';

import { config } from '@grafana/runtime';

import { Domain } from '../types';

const { colors } = config.theme2;

type state = 'firing' | 'pending' | 'unknown';

const STATE_COLORS: Record<state, string> = {
  firing: colors.error.main,
  pending: colors.warning.main,
  unknown: colors.background.primary,
};

interface StateRectangle {
  x: number;
  width: number;
  state: keyof typeof STATE_COLORS;
  color: string;
}

interface TimelineDataPoint {
  time: Date;
  state: keyof typeof STATE_COLORS;
}

export function processTimelineData(
  timeline: Array<[timestamp: string | number, 'firing' | 'pending']>
): TimelineDataPoint[] {
  // Use timeline data if provided, otherwise return empty array
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
              state: 'unknown',
            });
          }
        }
      }
    }

    data = filledData;
  }

  return data;
}

export function createStateRectangles(data: TimelineDataPoint[], domain: Domain, width: number): StateRectangle[] {
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
}
