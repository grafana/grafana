import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uPlot from 'uplot';

import { UPlotConfigBuilder } from '@grafana/ui';

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

  function applyScale(data: unknown[][], scales: unknown) {
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

  it('handles null value cache toggles correctly', () => {
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
});
