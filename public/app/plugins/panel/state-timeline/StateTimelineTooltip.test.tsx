import { render, screen } from '@testing-library/react';

import { createDataFrame, Field, FieldType, makeTimeRange } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/ui';

import { StateTimelineTooltip } from './StateTimelineTooltip';

describe('StateTimelineTooltip', () => {
  const timeRange = makeTimeRange('1970-01-01T00:00:00+00:00', '1970-01-01T00:02:00+00:00');
  const timeField: Field = {
    name: 'Time',
    type: FieldType.time,
    values: [0, 60000, 100000],
    display: (v) => ({ text: String(v), numeric: NaN }),
    config: {},
  };
  const valueField: Field = {
    name: 'State',
    type: FieldType.number,
    values: [0, 100, 50],
    display: (v) => ({ text: String(v), numeric: Number(v) }),
    config: {},
  };
  const series = createDataFrame({ fields: [timeField, valueField] });

  describe('Duration display', () => {
    it('should include the duration in single mode when withDuration is true', () => {
      render(
        <StateTimelineTooltip
          series={series}
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
          series={series}
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
              timeField,
              { ...valueField, name: 'StateA' },
              { ...valueField, name: 'StateB', values: [200, 400, 100] },
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
          series={series}
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
    const StateTimelineTooltipWithDataLinks = ({ isPinned }: { isPinned: boolean }) => (
      <StateTimelineTooltip
        series={series}
        seriesIdx={1}
        dataIdxs={[null, 1]}
        mode={TooltipDisplayMode.Single}
        timeRange={timeRange}
        withDuration
        dataLinks={[{ title: 'Regular Link', href: 'https://example.com', target: '_blank', origin: '*' }]}
        isPinned={isPinned}
      />
    );

    it('shows the footer if isPinned is true and there are data links', () => {
      render(<StateTimelineTooltipWithDataLinks isPinned />);
      const link = screen.queryByText('Regular Link');
      expect(link).toBeInTheDocument();
    });

    it('hides the footer if isPinned is false even if there are data links', () => {
      render(<StateTimelineTooltipWithDataLinks isPinned={false} />);
      const link = screen.queryByText('Regular Link');
      expect(link).not.toBeInTheDocument();
    });
  });

  describe('hideFrom configuration (issue #113082)', () => {
    it('should show field in tooltip when hidden from viz but not from tooltip', () => {
      const vizHiddenField: Field = {
        name: 'OrderNumber',
        type: FieldType.string,
        values: ['ORD123', 'ORD456', 'ORD789'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {
          custom: {
            hideFrom: {
              viz: true,      // Hidden from visualization
              legend: true,   // Hidden from legend
              tooltip: false, // But VISIBLE in tooltip
            },
          },
        },
      };

      const visibleField: Field = {
        name: 'HydraState',
        type: FieldType.string,
        values: ['PRODUCTION', 'IDLE', 'MAINTENANCE'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {},
      };

      const seriesWithHiddenField = createDataFrame({
        fields: [timeField, visibleField, vizHiddenField],
      });

      // Simulate tooltip hover: seriesIdx=1 (HydraState), but OrderNumber's dataIdx is null
      // because uPlot doesn't track cursor for viz-hidden fields
      render(
        <StateTimelineTooltip
          series={seriesWithHiddenField}
          seriesIdx={1}
          dataIdxs={[0, 1, null]} // OrderNumber (index 2) has null dataIdx from uPlot
          mode={TooltipDisplayMode.Multi}
          timeRange={timeRange}
          withDuration={false}
          dataLinks={[]}
          isPinned={false}
        />
      );

      // Both fields should appear in tooltip
      expect(screen.queryByText('HydraState')).toBeInTheDocument();
      expect(screen.queryByText('IDLE')).toBeInTheDocument();
      expect(screen.queryByText('OrderNumber')).toBeInTheDocument();
      expect(screen.queryByText('ORD456')).toBeInTheDocument(); // Should use index 1 from visible field
    });

    it('should NOT show field in tooltip when hidden from both viz and tooltip', () => {
      const fullyHiddenField: Field = {
        name: 'InternalId',
        type: FieldType.number,
        values: [1001, 1002, 1003],
        display: (v) => ({ text: String(v), numeric: Number(v) }),
        config: {
          custom: {
            hideFrom: {
              viz: true,
              legend: true,
              tooltip: true, // Hidden from tooltip as well
            },
          },
        },
      };

      const visibleField: Field = {
        name: 'Status',
        type: FieldType.string,
        values: ['Active', 'Pending', 'Complete'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {},
      };

      const seriesWithFullyHiddenField = createDataFrame({
        fields: [timeField, visibleField, fullyHiddenField],
      });

      render(
        <StateTimelineTooltip
          series={seriesWithFullyHiddenField}
          seriesIdx={1}
          dataIdxs={[0, 1, null]}
          mode={TooltipDisplayMode.Multi}
          timeRange={timeRange}
          withDuration={false}
          dataLinks={[]}
          isPinned={false}
        />
      );

      // Visible field should appear
      expect(screen.queryByText('Status')).toBeInTheDocument();
      expect(screen.queryByText('Pending')).toBeInTheDocument();

      // Hidden field should NOT appear
      expect(screen.queryByText('InternalId')).not.toBeInTheDocument();
      expect(screen.queryByText('1002')).not.toBeInTheDocument();
    });

    it('should work in Single mode with viz-hidden field', () => {
      const vizHiddenField: Field = {
        name: 'DetailCode',
        type: FieldType.string,
        values: ['ABC', 'DEF', 'GHI'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {
          custom: {
            hideFrom: {
              viz: true,
              legend: false,
              tooltip: false,
            },
          },
        },
      };

      const visibleField: Field = {
        name: 'MainState',
        type: FieldType.string,
        values: ['On', 'Off', 'Standby'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {},
      };

      const seriesWithMixedVisibility = createDataFrame({
        fields: [timeField, visibleField, vizHiddenField],
      });

      // In single mode, hovering over MainState (seriesIdx=1)
      render(
        <StateTimelineTooltip
          series={seriesWithMixedVisibility}
          seriesIdx={1}
          dataIdxs={[2, 2, null]} // DetailCode has null from uPlot
          mode={TooltipDisplayMode.Single}
          timeRange={timeRange}
          withDuration={false}
          dataLinks={[]}
          isPinned={false}
        />
      );

      // Only the hovered series should show in Single mode
      expect(screen.queryByText('MainState')).toBeInTheDocument();
      expect(screen.queryByText('Standby')).toBeInTheDocument();

      // Other field shouldn't show in Single mode (even if visible in tooltip config)
      expect(screen.queryByText('DetailCode')).not.toBeInTheDocument();
    });

    it('should handle multiple viz-hidden fields correctly', () => {
      const field1: Field = {
        name: 'Visible1',
        type: FieldType.string,
        values: ['A', 'B', 'C'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {},
      };

      const field2: Field = {
        name: 'HiddenViz1',
        type: FieldType.string,
        values: ['X', 'Y', 'Z'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {
          custom: {
            hideFrom: { viz: true, legend: false, tooltip: false },
          },
        },
      };

      const field3: Field = {
        name: 'HiddenViz2',
        type: FieldType.string,
        values: ['P', 'Q', 'R'],
        display: (v) => ({ text: String(v), numeric: NaN }),
        config: {
          custom: {
            hideFrom: { viz: true, legend: false, tooltip: false },
          },
        },
      };

      const seriesWithMultipleHidden = createDataFrame({
        fields: [timeField, field1, field2, field3],
      });

      render(
        <StateTimelineTooltip
          series={seriesWithMultipleHidden}
          seriesIdx={1}
          dataIdxs={[0, 0, null, null]} // Both hidden fields have null from uPlot
          mode={TooltipDisplayMode.Multi}
          timeRange={timeRange}
          withDuration={false}
          dataLinks={[]}
          isPinned={false}
        />
      );

      // All fields should appear (using index 0 from visible field)
      expect(screen.queryByText('Visible1')).toBeInTheDocument();
      expect(screen.queryByText('A')).toBeInTheDocument();
      expect(screen.queryByText('HiddenViz1')).toBeInTheDocument();
      expect(screen.queryByText('X')).toBeInTheDocument();
      expect(screen.queryByText('HiddenViz2')).toBeInTheDocument();
      expect(screen.queryByText('P')).toBeInTheDocument();
    });
  });
});
