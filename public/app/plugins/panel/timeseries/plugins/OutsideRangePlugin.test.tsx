import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uPlot from 'uplot';

import { UPlotConfigBuilder } from '@grafana/ui';

import { OutsideRangePlugin } from './OutsideRangePlugin';

describe('OutsideRangePlugin', () => {
  let hooks: Record<string, (u: uPlot) => {}> = {};
  const config = {
    addHook: jest.fn((type, hook) => {
      hooks[type] = hook;
    }),
  } as unknown as UPlotConfigBuilder;

  it('does not render the outside range controls when no data is set', () => {
    const { container } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render the outside range controls when no timerange is set', () => {
    const { container } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    act(() => {
      hooks.setScale({
        data: [
          [1000, 2000, 3000],
          [1, 2, 3],
        ],
        scales: {},
      } as unknown as uPlot);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render the outside range controls when there are data points within the time range', () => {
    const { container } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    act(() => {
      hooks.setScale({
        data: [
          [1000, 2000, 3000],
          [1, 2, 3],
        ],
        scales: {
          x: { time: true, min: 1500, max: 2500 },
        },
      } as unknown as uPlot);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the outside range controls when all data points are outside the time range', () => {
    const { getByText } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    act(() => {
      hooks.setScale({
        data: [
          [1000, 2000, 3000],
          [1, 2, 3],
        ],
        scales: {
          x: { time: true, min: 4000, max: 5000 },
        },
      } as unknown as uPlot);
    });

    expect(getByText('Data outside time range')).toBeInTheDocument();
  });

  it('zooms to time range when button is clicked', async () => {
    const onChangeTimeRange = jest.fn();
    const { getByText } = render(<OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />);

    act(() => {
      hooks.setScale({
        data: [
          [1000, 2000, 3000],
          [1, 2, 3],
        ],
        scales: {
          x: { time: true, min: 4000, max: 5000 },
        },
      } as unknown as uPlot);
    });

    const button = getByText('Zoom to data');
    await userEvent.click(button);

    expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1000, to: 3000 });
  });

  it('should not render anything for all null values', () => {
    const { container } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    act(() => {
      hooks.setScale({
        data: [
          [100, 200, 300],
          [null, null, null],
        ],
        scales: {
          x: { time: true, min: 4000, max: 5000 },
        },
      } as unknown as uPlot);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('should render when some values are null but all others are outside the time range', async () => {
    const onChangeTimeRange = jest.fn();
    const { getByText } = render(<OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />);

    act(() => {
      hooks.setScale({
        data: [
          [0, 500, 1000, 1500, 2000],
          [null, 2, null, 3, null],
        ],
        scales: {
          x: { time: true, min: 2500, max: 3500 },
        },
      } as unknown as uPlot);
    });

    expect(getByText('Data outside time range')).toBeInTheDocument();

    const button = getByText('Zoom to data');
    await userEvent.click(button);

    // The new range should be centered around the single point with the same width as the original range
    expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 500, to: 1500 });
  });

  it('should not render when some time values are null but at least one other is inside the range', () => {
    const { container } = render(<OutsideRangePlugin config={config} onChangeTimeRange={jest.fn()} />);

    act(() => {
      hooks.setScale({
        data: [
          [500, 1000, 1500, 2000],
          [1, 2, 3, 4],
        ],
        scales: {
          x: { time: true, min: 2000, max: 3000 },
        },
      } as unknown as uPlot);
    });

    expect(container).toBeEmptyDOMElement();
  });

  describe('single value cases', () => {
    it('should handle single time value outside range', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = render(<OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />);

      act(() => {
        hooks.setScale({
          data: [[2000], [1]],
          scales: {
            x: { time: true, min: 4000, max: 5000 },
          },
        } as unknown as uPlot);
      });

      const button = getByText('Zoom to data');
      await userEvent.click(button);

      // The new range should be centered around the single point with the same width as the original range
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 1500, to: 2500 });
    });

    it('handles a single non-null time value outside range', async () => {
      const onChangeTimeRange = jest.fn();
      const { getByText } = render(<OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />);

      act(() => {
        hooks.setScale({
          data: [
            [500, 1000, 1500, 2000, 2500, 3000],
            [null, 2, null, null, null, null],
          ],
          scales: {
            x: { time: true, min: 2000, max: 3000 },
          },
        } as unknown as uPlot);
      });

      const button = getByText('Zoom to data');
      await userEvent.click(button);

      // The new range should be centered around the single point with the same width as the original range
      expect(onChangeTimeRange).toHaveBeenCalledWith({ from: 500, to: 1500 });
    });
  });
});
