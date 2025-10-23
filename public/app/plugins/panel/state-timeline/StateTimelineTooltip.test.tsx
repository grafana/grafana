import { render, screen } from '@testing-library/react';

import { createDataFrame, FieldType, makeTimeRange } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/ui';

import { StateTimelineTooltip } from './StateTimelineTooltip';

describe('StateTimelineTooltip', () => {
  const timeRange = makeTimeRange('1970-01-01T00:00:00+00:00', '1970-01-01T00:02:00+00:00');
  describe('Duration display', () => {
    it('should include the duration in single mode when withDuration is true', () => {
      render(
        <StateTimelineTooltip
          series={createDataFrame({
            fields: [
              {
                name: 'Time',
                type: FieldType.time,
                values: [0, 60000, 100000],
                display: (v) => ({ text: String(v), numeric: NaN }),
              },
              {
                name: 'State',
                type: FieldType.number,
                values: [0, 100, 50],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
            ],
          })}
          seriesIdx={1}
          dataIdxs={[null, 1]}
          mode={TooltipDisplayMode.Single}
          timeRange={timeRange}
          withDuration
          dataLinks={[]}
          isPinned={false}
        />
      );

      expect(screen.queryByText('State')).toBeInTheDocument();
      expect(screen.queryByText('100')).toBeInTheDocument();
      expect(screen.queryByText('Duration')).toBeInTheDocument();
      expect(screen.queryByText('40s')).toBeInTheDocument(); // 100000 - 60000 = 40000 ms = 40s
    });

    it('correctly renders the final duration in a state timeline based on the range', () => {
      render(
        <StateTimelineTooltip
          series={createDataFrame({
            fields: [
              {
                name: 'Time',
                type: FieldType.time,
                values: [0, 60000, 100000],
                display: (v) => ({ text: String(v), numeric: NaN }),
              },
              {
                name: 'State',
                type: FieldType.number,
                values: [0, 100, 50],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
            ],
          })}
          seriesIdx={1}
          dataIdxs={[null, 2]}
          mode={TooltipDisplayMode.Single}
          timeRange={timeRange}
          withDuration
          dataLinks={[]}
          isPinned={false}
        />
      );

      expect(screen.queryByText('Duration')).toBeInTheDocument();
      expect(screen.queryByText('20s')).toBeInTheDocument(); // 120000 - 100000 = 20000 ms = 20s
    });

    it('should not include the duration in multi mode even when withDuration is true', () => {
      render(
        <StateTimelineTooltip
          series={createDataFrame({
            fields: [
              {
                name: 'Time',
                type: FieldType.time,
                values: [0, 60000, 100000],
                display: (v) => ({ text: String(v), numeric: NaN }),
              },
              {
                name: 'StateA',
                type: FieldType.number,
                values: [0, 100, 50],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
              {
                name: 'StateB',
                type: FieldType.number,
                values: [200, 400, 300],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
            ],
          })}
          seriesIdx={1}
          dataIdxs={[null, 1, 1]}
          mode={TooltipDisplayMode.Multi}
          timeRange={timeRange}
          withDuration
          dataLinks={[]}
          isPinned={false}
        />
      );

      expect(screen.queryByText('StateA')).toBeInTheDocument();
      expect(screen.queryByText('StateB')).toBeInTheDocument();
      expect(screen.queryByText('Duration')).not.toBeInTheDocument();
    });

    it('works without a seriesIdx is withDuration is false', () => {
      render(
        <StateTimelineTooltip
          series={createDataFrame({
            fields: [
              {
                name: 'Time',
                type: FieldType.time,
                values: [0, 60000, 100000],
                display: (v) => ({ text: String(v), numeric: NaN }),
              },
              {
                name: 'State',
                type: FieldType.number,
                values: [0, 100, 50],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
            ],
          })}
          dataIdxs={[null, 1]}
          mode={TooltipDisplayMode.Single}
          timeRange={timeRange}
          withDuration={false}
          dataLinks={[]}
          isPinned={false}
        />
      );

      expect(screen.queryByText('60000')).toBeInTheDocument();
      expect(screen.queryByText('State')).not.toBeInTheDocument();
      expect(screen.queryByText('Duration')).not.toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it.each([
      ['hides', true],
      ['shows', false],
    ])('%s the footer based on isPinned=%s', (_title, isPinned) => {
      render(
        <StateTimelineTooltip
          series={createDataFrame({
            fields: [
              {
                name: 'Time',
                type: FieldType.time,
                values: [0, 60000, 100000],
                display: (v) => ({ text: String(v), numeric: NaN }),
              },
              {
                name: 'State',
                type: FieldType.number,
                values: [0, 100, 50],
                display: (v) => ({ text: String(v), numeric: Number(v) }),
              },
            ],
          })}
          seriesIdx={1}
          dataIdxs={[null, 1]}
          mode={TooltipDisplayMode.Single}
          timeRange={timeRange}
          withDuration
          dataLinks={[{ title: 'Regular Link', href: 'https://example.com', target: '_blank', origin: '*' }]}
          isPinned={isPinned}
        />
      );

      // Footer content should not be present
      const link = screen.queryByText('Regular Link');
      if (isPinned) {
        expect(link).toBeInTheDocument();
      } else {
        expect(link).not.toBeInTheDocument();
      }
    });
  });
});
