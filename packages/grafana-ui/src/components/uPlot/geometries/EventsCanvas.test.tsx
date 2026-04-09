import { act, render, screen } from '@testing-library/react';
import uPlot from 'uplot';

import { createDataFrame, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { type UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { EventsCanvas } from './EventsCanvas';

describe('EventsCanvas', () => {
  let hooks: Record<string, ((...args: unknown[]) => void) | undefined>;

  beforeEach(() => {
    hooks = {};
  });

  const createConfig = (): UPlotConfigBuilder =>
    ({
      addHook: jest.fn((type: string, hook: (...args: unknown[]) => void) => {
        hooks[type] = hook;
      }),
    }) as unknown as UPlotConfigBuilder;

  /** Simulates uPlot calling registered hooks: `init` sets the plot ref; `draw` forces a React update (refs alone do not). */
  const runPlotHooks = (bbox: { left: number; top: number }) => {
    act(() => {
      hooks.init?.({ bbox });
    });
    act(() => {
      hooks.draw?.();
    });
  };

  it('renders nothing before uPlot init and draw hooks have run', () => {
    const config = createConfig();
    render(
      <EventsCanvas
        id="events-test"
        config={config}
        events={[]}
        renderEventMarker={() => null}
        mapEventToXYCoords={() => undefined}
      />
    );

    expect(screen.queryByTestId(selectors.components.UPlotChart.xyCanvas)).not.toBeInTheDocument();
  });

  it('renders XYCanvas offset by plot bbox (CSS pixels)', () => {
    const dpr = uPlot.pxRatio;
    const config = createConfig();
    render(
      <EventsCanvas
        id="events-test"
        config={config}
        events={[]}
        renderEventMarker={() => null}
        mapEventToXYCoords={() => undefined}
      />
    );

    runPlotHooks({ left: 16, top: 8 });

    const canvas = screen.getByTestId(selectors.components.UPlotChart.xyCanvas);
    expect(canvas).toHaveStyle({
      left: `${16 / dpr}px`,
      top: `${8 / dpr}px`,
    });
  });

  it('renders markers produced by renderEventMarker when mapEventToXYCoords returns coordinates', () => {
    const events = [
      createDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          { name: 'Value', type: FieldType.number, values: [1] },
        ],
      }),
    ];
    const config = createConfig();
    render(
      <EventsCanvas
        id="events-test"
        config={config}
        events={events}
        renderEventMarker={() => <span data-testid="event-marker-label">exemplar</span>}
        mapEventToXYCoords={() => ({ x: 2, y: 3 })}
      />
    );

    runPlotHooks({ left: 0, top: 0 });

    expect(screen.getByTestId('event-marker-label')).toHaveTextContent('exemplar');
  });
});
