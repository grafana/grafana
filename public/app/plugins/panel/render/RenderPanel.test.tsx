import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, FieldType, LoadingState, type PanelData, type PanelProps } from '@grafana/data';
import { config, locationService, setTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import { getPanelProps } from '../test-utils';

import { RenderPanel } from './RenderPanel';
import { type RenderFrameError, type RenderFrameHandlers, type RenderInput } from './runtime';
import { type Options } from './types';

interface FakeController {
  handlers: RenderFrameHandlers;
  handleLoad: jest.Mock;
  render: jest.Mock<number, [RenderInput]>;
  resize: jest.Mock<number, [{ width: number; height: number }]>;
  pause: jest.Mock;
  resume: jest.Mock;
  getState: jest.Mock;
  dispose: jest.Mock;
}
interface FakeHold {
  release: jest.Mock;
  released: boolean;
}

const mockControllers: FakeController[] = [];
const mockHolds: FakeHold[] = [];

// The real document builder and link validation run; only the iframe controller and the readiness
// registry are replaced, because jsdom cannot run the sandboxed frame.
jest.mock('./runtime', () => ({
  ...jest.requireActual('./runtime'),
  createRenderFrameController: (handlers: RenderFrameHandlers) => {
    let seq = 0;
    const controller: FakeController = {
      handlers,
      handleLoad: jest.fn(),
      render: jest.fn((_input: RenderInput) => ++seq),
      resize: jest.fn((_size: { width: number; height: number }) => ++seq),
      pause: jest.fn(),
      resume: jest.fn(),
      getState: jest.fn(() => 'ready'),
      dispose: jest.fn(),
    };
    mockControllers.push(controller);
    return controller;
  },
  holdRenderReadiness: () => {
    const hold: FakeHold = {
      released: false,
      release: jest.fn(() => {
        hold.released = true;
      }),
    };
    mockHolds.push(hold);
    return hold;
  },
}));

const CODE = "panel.onRender(({ root }) => { root.textContent = 'hi'; });";

function makeData(values: number[], state = LoadingState.Done): PanelData {
  const props = getPanelProps<Options>({ code: CODE });
  return {
    ...props.data,
    state,
    series: [
      createDataFrame({
        refId: 'A',
        fields: [{ name: 'value', type: FieldType.number, values }],
      }),
    ],
  };
}

function setup(overrides: Partial<Omit<PanelProps<Options>, 'options'>> = {}, options: Options = { code: CODE }) {
  const props = getPanelProps<Options>(options, { data: makeData([1, 2, 3]), ...overrides });
  const view = render(<RenderPanel {...props} />);
  const rerender = (next: Partial<Omit<PanelProps<Options>, 'options'>>) =>
    view.rerender(<RenderPanel {...props} {...next} />);
  return { ...view, props, rerender };
}

const frame = () => screen.getByTitle('Panel drawing');
const latestController = () => mockControllers[mockControllers.length - 1];
const latestHold = () => mockHolds[mockHolds.length - 1];

function fail(kind: RenderFrameError['kind'], fatal: boolean) {
  act(() => latestController().handlers.onError({ kind, fatal, message: 'boom at line 3' }));
}

describe('RenderPanel', () => {
  beforeAll(() => {
    setTemplateSrv({ getVariables: () => [] } as unknown as TemplateSrv);
  });

  beforeEach(() => {
    mockControllers.length = 0;
    mockHolds.length = 0;
    config.publicDashboardAccessToken = undefined;
    jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    jest.spyOn(locationService, 'push').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the code in an iframe that only allows scripts', () => {
    setup();

    expect(frame().getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame().getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('shows an empty state and no iframe when there is no code', () => {
    setup({}, { code: '  \n ' });

    expect(screen.getByText('Add drawing code in the panel options to render this panel.')).toBeInTheDocument();
    expect(screen.queryByTitle('Panel drawing')).not.toBeInTheDocument();
    expect(mockControllers).toHaveLength(0);
  });

  it('connects the controller on the iframe load', () => {
    setup();
    fireEvent.load(frame());

    expect(latestController().handleLoad).toHaveBeenLastCalledWith(frame());
  });

  it('sends new data to the same iframe instead of recreating it', () => {
    const { rerender } = setup();
    const first = frame();

    rerender({ data: makeData([4, 5, 6]) });

    expect(frame()).toBe(first);
    expect(mockControllers).toHaveLength(1);
    const input = latestController().render.mock.lastCall![0];
    expect(input.data.series[0].fields[0].values).toEqual([4, 5, 6]);
    expect(input.size).toEqual({ width: 320, height: 400 });
  });

  it('resizes without re-sending the data when only the size changes', () => {
    const { rerender } = setup();
    expect(latestController().render).toHaveBeenCalledTimes(1);

    rerender({ width: 500, height: 200 });

    expect(latestController().render).toHaveBeenCalledTimes(1);
    expect(latestController().resize).toHaveBeenLastCalledWith({ width: 500, height: 200 });
  });

  it('holds image rendering until a draw of final data completes', () => {
    const { rerender } = setup({ data: makeData([1], LoadingState.Loading) });
    act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 3, nodeCount: 4 }));
    expect(latestHold().released).toBe(false);

    rerender({ data: makeData([1, 2], LoadingState.Done) });
    expect(latestHold().released).toBe(false);

    act(() => latestController().handlers.onRenderComplete({ seq: 2, durationMs: 3, nodeCount: 4 }));
    expect(latestHold().released).toBe(true);
  });

  it('removes an unresponsive frame, releases the hold and offers a retry that uses a new iframe', async () => {
    setup();
    const first = frame();
    fail('unresponsive', true);

    expect(latestHold().released).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('The drawing code stopped responding.');
    // Removing the element is what tears the hung document down.
    expect(first.isConnected).toBe(false);
    expect(screen.queryByTitle('Panel drawing')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockControllers[0].dispose).toHaveBeenCalled();
    expect(mockControllers).toHaveLength(2);
    const second = frame();
    expect(second).not.toBe(first);
    fireEvent.load(second);
    expect(mockControllers[1].handleLoad).toHaveBeenLastCalledWith(second);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The new frame gets the current data right away.
    expect(mockControllers[1].render).toHaveBeenCalledTimes(1);

    // A frame that hangs again is removed again; the panel never stays on a dead frame.
    fail('unresponsive', true);
    expect(second.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows a non-fatal error over the frame and clears it on the next completed draw', () => {
    setup();
    fail('runtime', false);

    expect(screen.getByText('The drawing code failed')).toBeInTheDocument();
    expect(screen.getByText('boom at line 3')).toBeInTheDocument();
    expect(frame()).toBeInTheDocument();
    expect(latestHold().released).toBe(false);

    act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 1, nodeCount: 1 }));
    expect(screen.queryByText('The drawing code failed')).not.toBeInTheDocument();
  });

  it('opens a panel of this dashboard from a #panel link', () => {
    setup();
    act(() => latestController().handlers.onLink('#panel-4'));

    expect(locationService.partial).toHaveBeenCalledWith({ viewPanel: 'panel-4' });
  });

  it('ignores links to other sites', () => {
    setup();
    act(() => latestController().handlers.onLink('https://evil.example.com'));

    expect(locationService.partial).not.toHaveBeenCalled();
    expect(locationService.push).not.toHaveBeenCalled();
  });

  it('ignores every link on public dashboards', () => {
    config.publicDashboardAccessToken = 'token';
    setup();
    act(() => latestController().handlers.onLink('#panel-4'));

    expect(locationService.partial).not.toHaveBeenCalled();
  });

  it('shows a limit message instead of sending data over the cell limit', () => {
    const values = Array.from({ length: 100_001 }, (_, i) => i);
    setup({ data: makeData(values) });

    expect(screen.getByText('Too much data to draw')).toBeInTheDocument();
    expect(screen.getByText(/The queries returned 100001 values/)).toBeInTheDocument();
    expect(latestController().render).not.toHaveBeenCalled();
    expect(latestHold().released).toBe(true);
  });
});
