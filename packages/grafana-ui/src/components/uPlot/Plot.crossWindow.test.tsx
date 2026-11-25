import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import type uPlot from 'uplot';

import { createTheme, FieldType, toDataFrame } from '@grafana/data';
import { ScaleDirection, ScaleOrientation } from '@grafana/schema';

import { UPlotChart } from './Plot';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import { preparePlotData2, getStackingGroups } from './utils';

// Unlike Plot.test.tsx, this suite runs the real uPlot: the bug lives in how uPlot treats its mount target.

function setup() {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
      { name: 'value', type: FieldType.number, values: [10, 20, 5] },
    ],
  });
  const config = new UPlotConfigBuilder();
  config.addScale({
    scaleKey: 'x',
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
  });
  config.addScale({ scaleKey: 'y', orientation: ScaleOrientation.Vertical, direction: ScaleDirection.Up });
  config.addSeries({ scaleKey: 'y', theme: createTheme() });

  return { data: preparePlotData2(frame, getStackingGroups(frame)), config };
}

describe('UPlotChart mount target', () => {
  it('mounts the plot inside its container when the container is in this window', () => {
    const { data, config } = setup();
    let plot: uPlot | undefined;

    render(<UPlotChart data={data} config={config} width={300} height={150} plotRef={(u) => (plot = u)} />);

    const container = screen.getByTestId('uplot-main-div');
    expect(plot?.root.parentElement).toBe(container);
  });

  // A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another realm, as an iframe is: its
  // elements are not `instanceof` this window's HTMLElement, which uPlot used to mistake for a mount callback.
  it('mounts the plot inside its container when the container is in another window', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const otherDocument = iframe.contentDocument!;
    const { data, config } = setup();
    let plot: uPlot | undefined;

    const { unmount } = render(
      createPortal(
        <UPlotChart data={data} config={config} width={300} height={150} plotRef={(u) => (plot = u)} />,
        otherDocument.body
      )
    );

    const container = otherDocument.querySelector('[data-testid="uplot-main-div"]');
    expect(container).not.toBeInstanceOf(HTMLElement);
    expect(plot?.root.parentElement).toBe(container);
    expect(plot?.root.ownerDocument).toBe(otherDocument);

    // Unmount before the iframe goes, or React cannot remove the portalled plot from it.
    unmount();
    iframe.remove();
  });
});
