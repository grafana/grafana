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

  function renderPlugin(onChangeTimeRange = jest.fn(), holdLastValue?: boolean) {
    return render(
      <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} holdLastValue={holdLastValue} />
    );
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

  describe('when the last value is held', () => {
    it('does not render when the last value starts before the time range', () => {
      const { container } = renderPlugin(jest.fn(), true);

      applyScale([[1000], [2]], { x: { time: true, min: 2000, max: 3000 } });

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when trailing values are undefined', () => {
      const { container } = renderPlugin(jest.fn(), true);

      applyScale(
        [
          [500, 1000, 1500],
          [1, 2, undefined],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders when the last value ends before the time range', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = renderPlugin(onChangeTimeRange, true);

      applyScale(
        [
          [500, 1000, 1500],
          [1, 2, null],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(getByText('Data outside time range')).toBeInTheDocument();

      await userEvent.click(getByText('Zoom to data'));
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 500, to: 1000 });
    });

    it('renders when a null after trailing undefined values ends the last value before the time range', () => {
      const { getByText } = renderPlugin(jest.fn(), true);

      applyScale(
        [
          [500, 1000, 1500, 1800],
          [1, 2, undefined, null],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(getByText('Data outside time range')).toBeInTheDocument();
    });

    it('renders when every joined series has ended before the time range', () => {
      const { getByText } = renderPlugin(jest.fn(), true);

      applyScale(
        [
          [500, 1000, 1500, 1800],
          [1, undefined, null, undefined],
          [undefined, 2, undefined, null],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(getByText('Data outside time range')).toBeInTheDocument();
    });

    it('does not render when one joined series is still held into the time range', () => {
      const { container } = renderPlugin(jest.fn(), true);

      applyScale(
        [
          [500, 1000, 1500, 1800],
          [1, undefined, null, undefined],
          [undefined, 2, undefined, undefined],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders when all values start after the time range', () => {
      const { getByText } = renderPlugin(jest.fn(), true);

      applyScale(
        [
          [4000, 4500],
          [1, 2],
        ],
        { x: { time: true, min: 2000, max: 3000 } }
      );

      expect(getByText('Data outside time range')).toBeInTheDocument();
    });
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
});
