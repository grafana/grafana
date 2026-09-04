import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type uPlot from 'uplot';

import { type UPlotConfigBuilder } from '@grafana/ui';

import { OutsideRangePlugin } from './OutsideRangePlugin';

describe('OutsideRangePlugin', () => {
  let hooks: Record<string, (u: uPlot) => {}>;
  let config: UPlotConfigBuilder;

  beforeEach(() => {
    hooks = {};
    config = {
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;
  });

  function renderPlugin(onChangeTimeRange = jest.fn()) {
    return render(<OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />);
  }

  function applyScale(data: uPlot['data'] | undefined, scales: uPlot['scales']) {
    act(() => {
      hooks.setScale({
        data,
        scales,
      } as unknown as uPlot);
    });
  }

  it('does not render when no data or no timerange is set', () => {
    const { container } = renderPlugin();
    expect(container).toBeEmptyDOMElement();

    // no timerange
    applyScale(
      [
        [1000, 2000, 3000],
        [1, 2, 3],
      ],
      {}
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when there are data points within the time range', () => {
    const { container } = renderPlugin();

    applyScale(
      [
        [1000, 2000, 3000],
        [1, 2, 3],
      ],
      { x: { time: true, min: 1500, max: 2500 } }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders when all data points are outside the time range and allows zoom', async () => {
    const onChangeTimeRange = jest.fn();
    const { getByText } = renderPlugin(onChangeTimeRange);

    applyScale(
      [
        [1000, 2000, 3000],
        [1, 2, 3],
      ],
      { x: { time: true, min: 4000, max: 5000 } }
    );

    expect(getByText('Data outside time range')).toBeInTheDocument();

    const button = getByText('Zoom to data');
    await userEvent.click(button);
    expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1000, to: 3000 });
  });

  it('does not render for all-null value series', () => {
    const { container } = renderPlugin();

    applyScale(
      [
        [100, 200, 300],
        [null, null, null],
      ],
      { x: { time: true, min: 4000, max: 5000 } }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders when some values are null but remaining points are outside range', async () => {
    const onChangeTimeRange = jest.fn();
    const { getByText } = renderPlugin(onChangeTimeRange);

    applyScale(
      [
        [0, 500, 1000, 1500, 2000],
        [null, 2, null, 3, null],
      ],
      { x: { time: true, min: 2500, max: 3500 } }
    );

    expect(getByText('Data outside time range')).toBeInTheDocument();

    const button = getByText('Zoom to data');
    await userEvent.click(button);
    expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 500, to: 1500 });
  });

  describe('single value cases', () => {
    it('centers new range for single outside point', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange);

      applyScale([[2000], [1]], { x: { time: true, min: 4000, max: 5000 } });

      const button = getByText('Zoom to data');
      await userEvent.click(button);
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1500, to: 2500 });
    });

    it('handles single non-null time value among nulls', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange);

      applyScale(
        [
          [500, 1000, 1500, 2000, 2500, 3000],
          [null, 2, null, null, null, null],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      const button = getByText('Zoom to data');
      await userEvent.click(button);
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 500, to: 1500 });
    });
  });

  it('handles changes to the data correctly', () => {
    const { container } = renderPlugin();

    // initial: one point inside range -> not rendered
    applyScale(
      [
        [500, 1000, 1500, 2000],
        [1, 2, 3, 4],
      ],
      { x: { time: true, min: 2000, max: 3000 } }
    );
    expect(container).toBeEmptyDOMElement();

    // switch to all outside -> rendered
    applyScale(
      [
        [500, 1000, 1500, 2000],
        [1, 2, 3, 4],
      ],
      { x: { time: true, min: 2500, max: 3500 } }
    );
    expect(container).not.toBeEmptyDOMElement();

    // back to one inside -> not rendered
    applyScale(
      [
        [500, 1000, 1500, 2000],
        [1, 2, 3, 4],
      ],
      { x: { time: true, min: 2000, max: 3000 } }
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('edge cases', () => {
    it('should not fail if data is missing', () => {
      const { container } = renderPlugin();
      applyScale(undefined, {});
      expect(container).toBeEmptyDOMElement();
    });

    it('should not fail if data is empty time data is present', () => {
      const { container } = renderPlugin();
      applyScale([], {});
      expect(container).toBeEmptyDOMElement();
    });

    it('should not fail if only time data is present', () => {
      const { container } = renderPlugin();
      applyScale([[1, 2, 3]], { x: { time: true, min: 2000, max: 3000 } });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('null timestamps', () => {
    // Regression for #130379. A row whose time column is null (e.g. an
    // outer-join miss in a SQL datasource) used to slip past the boundary
    // scan because allValuesNullAtIndex only inspects the value series, and
    // then `first` ended up as null. Clicking "Zoom to data" would call
    // onChangeTimeRange({ from: null, to: ... }), and PanelQueryRunner's
    // timeRange.from.valueOf() would throw "Cannot read properties of
    // undefined (reading 'valueOf')" — the original panel crash.
    //
    // uPlot types its AlignedData xValues as number[], so the test fixture
    // must cast through `unknown` to express the real production case (the
    // time field is allowed to contain null at the panel-render layer).
    function withNullTimes(fixture: unknown[]): uPlot['data'] {
      return fixture as uPlot['data'];
    }

    it('skips a leading null timestamp and zooms to the first valid time', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange);

      applyScale(
        withNullTimes([
          [null, 1000, 1500, 2000, 2500, 3000],
          [1, 2, 3, 4, 5, 6],
        ]),
        { x: { time: true, min: 4000, max: 5000 } }
      );

      const button = getByText('Zoom to data');
      await userEvent.click(button);
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1000, to: 3000 });
    });

    it('skips a trailing null timestamp and zooms to the last valid time', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange);

      applyScale(
        withNullTimes([
          [1000, 1500, 2000, 2500, 3000, null],
          [1, 2, 3, 4, 5, 6],
        ]),
        { x: { time: true, min: 4000, max: 5000 } }
      );

      const button = getByText('Zoom to data');
      await userEvent.click(button);
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1000, to: 3000 });
    });

    it('does not render the zoom button when every timestamp is null', () => {
      const onChangeTimeRange = jest.fn();
      const { container } = renderPlugin(onChangeTimeRange);

      applyScale(
        withNullTimes([
          [null, null, null, null],
          [1, 2, 3, 4],
        ]),
        { x: { time: true, min: 4000, max: 5000 } }
      );

      expect(container).toBeEmptyDOMElement();
      expect(onChangeTimeRange).not.toHaveBeenCalled();
    });

    it('passes a non-null `from` even when the first non-null time is mid-array', async () => {
      // Catches the original crash directly: the first two rows have a null
      // time, the third has a valid time, and the rest are all-null values.
      // Without the null-time skip, the loop stops at i=0 (value column is
      // null in the all-null-value case but the time value at i=0 is null in
      // the all-null-time case), `first` becomes null, and the click
      // propagates that null into the time range service.
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange);

      applyScale(
        withNullTimes([
          [null, null, 1500, 2000, 2500, null],
          [1, 2, 3, 4, 5, 6],
        ]),
        { x: { time: true, min: 4000, max: 5000 } }
      );

      const button = getByText('Zoom to data');
      await userEvent.click(button);
      // `from` is the first non-null timestamp (1500), `to` is the last
      // non-null timestamp (2500) — both guaranteed non-null.
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1500, to: 2500 });
      const lastCall = onChangeTimeRange.mock.calls[onChangeTimeRange.mock.calls.length - 1][0];
      expect(lastCall.from).not.toBeNull();
      expect(lastCall.to).not.toBeNull();
    });
  });
});
