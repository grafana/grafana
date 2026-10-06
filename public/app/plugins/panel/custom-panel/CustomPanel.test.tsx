import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, FieldType, LoadingState, type PanelData, type PanelProps } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  capturePanelRender,
  getPanelRenderData,
  getPanelRenderStatus,
  getPanelRenderStatuses,
} from 'app/features/panel/panelRenderStatus';

import { getPanelProps } from '../test-utils';

import { CustomPanel } from './CustomPanel';
import { codeDigest, type RenderFrameError, type RenderFrameHandlers, type RenderInput } from './runtime';
import { type Options } from './types';

interface FakeController {
  handlers: RenderFrameHandlers;
  handleLoad: jest.Mock;
  render: jest.Mock<number, [RenderInput]>;
  resize: jest.Mock<number, [{ width: number; height: number }]>;
  pause: jest.Mock;
  resume: jest.Mock;
  getState: jest.Mock;
  capture: jest.Mock;
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
      capture: jest.fn(() => Promise.resolve('data:image/png;base64,AA==')),
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

const mockFollowLink = jest.fn();
jest.mock('./followLink', () => ({
  followLink: (...args: unknown[]) => {
    mockFollowLink(...args);
    return jest.requireActual('./followLink').followLink(...args);
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
  const view = render(<CustomPanel {...props} />);
  const rerender = (next: Partial<Omit<PanelProps<Options>, 'options'>>) =>
    view.rerender(<CustomPanel {...props} {...next} />);
  return { ...view, props, rerender };
}

const frame = () => screen.getByTitle('Panel drawing');
const latestController = () => mockControllers[mockControllers.length - 1];
const latestHold = () => mockHolds[mockHolds.length - 1];

function fail(kind: RenderFrameError['kind'], fatal: boolean) {
  act(() => latestController().handlers.onError({ kind, fatal, message: 'boom at line 3' }));
}

describe('CustomPanel', () => {
  beforeEach(() => {
    mockControllers.length = 0;
    mockHolds.length = 0;
    mockFollowLink.mockClear();
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
    expect(input).toMatchObject({ width: 320, height: 400 });
  });

  it('resizes without re-sending the data when only the size changes', () => {
    const { rerender } = setup();
    expect(latestController().render).toHaveBeenCalledTimes(1);

    rerender({ width: 500, height: 200 });

    expect(latestController().render).toHaveBeenCalledTimes(1);
    expect(latestController().resize).toHaveBeenLastCalledWith({ width: 500, height: 200 });
  });

  it('sends the PanelProps-shaped input, without the code in the options', () => {
    setup({ id: 12, title: 'Overview', transparent: true });
    const input = latestController().render.mock.lastCall![0];

    expect(input).toMatchObject({ id: 12, title: 'Overview', transparent: true, fitContent: false, options: {} });
    expect(input.data.series[0].fields[0]).toMatchObject({ name: 'value', type: 'number', values: [1, 2, 3] });
  });

  it('shows an error and no frame for a drawing API version this Grafana does not support', () => {
    setup({}, { code: CODE, apiVersion: 99 });

    expect(screen.getByText('Unsupported drawing API version')).toBeInTheDocument();
    expect(screen.getByText(/saved with drawing API version 99/)).toBeInTheDocument();
    expect(screen.queryByTitle('Panel drawing')).not.toBeInTheDocument();
    expect(mockControllers).toHaveLength(0);
  });

  describe('location', () => {
    beforeEach(() => {
      locationService.replace('/d/abc/overview?var-env=prod');
    });

    it('sends the dashboard pathname and search', () => {
      setup();

      expect(latestController().render.mock.lastCall![0].location).toEqual({
        pathname: '/d/abc/overview',
        search: '?var-env=prod',
      });
    });

    it('redraws when only the URL changes, with the same data and time range', () => {
      setup();
      act(() => locationService.replace('/d/abc/overview?var-env=dev'));

      expect(latestController().render).toHaveBeenCalledTimes(2);
      expect(latestController().render.mock.lastCall![0].location.search).toBe('?var-env=dev');
      expect(latestController().resize).not.toHaveBeenCalled();
    });

    it('does not redraw when the URL is set to the same value', () => {
      const { rerender } = setup();
      act(() => locationService.replace('/d/abc/overview?var-env=prod'));
      rerender({ width: 500, height: 200 });

      expect(latestController().render).toHaveBeenCalledTimes(1);
      expect(latestController().resize).toHaveBeenCalledTimes(1);
    });
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

  it('takes a new readiness hold for each draw of final data', () => {
    const { rerender } = setup({ data: makeData([1], LoadingState.Done) });
    const complete = (seq: number) =>
      act(() => latestController().handlers.onRenderComplete({ seq, durationMs: 1, nodeCount: 1 }));
    expect(mockHolds).toHaveLength(1);
    complete(1);
    expect(mockHolds[0].released).toBe(true);

    // A second Done update: the capture must wait for this draw too.
    rerender({ data: makeData([1, 2], LoadingState.Done) });
    expect(mockHolds).toHaveLength(2);
    expect(mockHolds[1].released).toBe(false);
    // A late completion of the earlier draw does not end the new wait.
    complete(1);
    expect(mockHolds[1].released).toBe(false);
    complete(2);
    expect(mockHolds[1].released).toBe(true);

    // A failed draw of final data ends its own wait.
    rerender({ data: makeData([1, 2, 3], LoadingState.Done) });
    expect(mockHolds).toHaveLength(3);
    act(() => latestController().handlers.onError({ kind: 'runtime', seq: 3, fatal: false, message: 'boom' }));
    expect(mockHolds[2].released).toBe(true);

    // Two Done updates before the frame draws share one hold, released by the latest draw.
    rerender({ data: makeData([4], LoadingState.Done) });
    rerender({ data: makeData([5], LoadingState.Done) });
    expect(mockHolds).toHaveLength(4);
    complete(4);
    expect(mockHolds[3].released).toBe(false);
    complete(5);
    expect(mockHolds[3].released).toBe(true);
    expect(mockHolds.every((hold) => hold.release.mock.calls.length >= 1)).toBe(true);
  });

  it('takes a hold for a resize of final data and not for data that is still loading', () => {
    const data = makeData([1], LoadingState.Done);
    const { rerender } = setup({ data });
    act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 1, nodeCount: 1 }));

    rerender({ data, width: 500, height: 200 });
    expect(latestController().resize).toHaveBeenCalledTimes(1);
    expect(mockHolds).toHaveLength(2);

    act(() => latestController().handlers.onRenderComplete({ seq: 2, durationMs: 1, nodeCount: 1 }));
    expect(mockHolds[1].released).toBe(true);

    rerender({ data: makeData([1, 2], LoadingState.Loading) });
    expect(mockHolds).toHaveLength(2);
  });

  it.each([
    ['runtime', 1],
    ['output-limit', 1],
    ['startup', undefined],
  ] as const)('releases the readiness hold when the frame reports a %s error for final data', (kind, seq) => {
    setup();
    expect(latestHold().released).toBe(false);

    act(() => latestController().handlers.onError({ kind, seq, fatal: false, message: 'boom' }));

    expect(latestHold().released).toBe(true);
    expect(frame()).toBeInTheDocument();
  });

  it('keeps holding when the error is for a draw of data that is still loading', () => {
    const { rerender } = setup({ data: makeData([1], LoadingState.Loading) });
    act(() => latestController().handlers.onError({ kind: 'runtime', seq: 1, fatal: false, message: 'boom' }));
    act(() => latestController().handlers.onError({ kind: 'output-limit', seq: 1, fatal: false, message: 'boom' }));
    // Errors that are not tied to a draw do not end the wait either.
    act(() => latestController().handlers.onError({ kind: 'runtime', fatal: false, message: 'late timer' }));
    act(() => latestController().handlers.onError({ kind: 'csp', seq: 1, fatal: false, message: 'img-src x' }));
    expect(latestHold().released).toBe(false);

    rerender({ data: makeData([1, 2], LoadingState.Done) });
    act(() => latestController().handlers.onError({ kind: 'runtime', seq: 2, fatal: false, message: 'boom' }));
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

  it.each(['#panel-4', '?editPanel=panel-4', '#explore-panel-4', '#focus-panel-4'])(
    'ignores %s on public dashboards',
    (href) => {
      config.publicDashboardAccessToken = 'token';
      setup();
      act(() => latestController().handlers.onLink(href));

      expect(mockFollowLink).not.toHaveBeenCalled();
      expect(locationService.partial).not.toHaveBeenCalled();
      expect(locationService.push).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['?editPanel=panel-4', { kind: 'dashboard-state', params: { editPanel: 'panel-4' } }],
    ['#explore-panel-4', { kind: 'explore-panel', panelId: 4 }],
    ['#focus-panel-4', { kind: 'focus-panel', panelId: 4 }],
  ])('follows %s', (href, target) => {
    setup();
    act(() => latestController().handlers.onLink(href));

    expect(mockFollowLink).toHaveBeenCalledWith(target);
  });

  it('shows a limit message instead of sending data over the cell limit', () => {
    const values = Array.from({ length: 100_001 }, (_, i) => i);
    setup({ data: makeData(values) });

    expect(screen.getByText('Too much data to draw')).toBeInTheDocument();
    expect(screen.getByText(/The queries returned 100001 values/)).toBeInTheDocument();
    expect(latestController().render).not.toHaveBeenCalled();
    expect(latestHold().released).toBe(true);
  });
  describe('draw status', () => {
    it('reports pending, then the finished draw with the code digest, data state and timing', () => {
      const { props } = setup();
      expect(getPanelRenderStatus(props.id)).toEqual(
        expect.objectContaining({ pluginId: 'custom-panel', state: 'pending', digest: codeDigest(CODE) })
      );

      act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 4, nodeCount: 9 }));

      expect(getPanelRenderStatus(props.id)).toEqual(
        expect.objectContaining({
          state: 'drawn',
          final: true,
          dataState: LoadingState.Done,
          digest: codeDigest(CODE),
          durationMs: 4,
          nodeCount: 9,
        })
      );
    });

    it('reports a draw error, and keeps non-fatal problems with a draw that still finishes', () => {
      const { props } = setup();
      act(() =>
        latestController().handlers.onError({ kind: 'csp', fatal: false, message: 'img-src https://x', seq: 1 })
      );
      expect(getPanelRenderStatus(props.id)).toEqual(
        expect.objectContaining({ state: 'error', error: { kind: 'csp', message: 'img-src https://x' } })
      );

      act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 1, nodeCount: 2 }));
      expect(getPanelRenderStatus(props.id)).toEqual(
        expect.objectContaining({ state: 'drawn', diagnostics: ['csp: img-src https://x'] })
      );
    });

    it('reports data over the limit as an error', () => {
      const values = Array.from({ length: 100_001 }, (_, i) => i);
      const { props } = setup({ data: makeData(values) });
      expect(getPanelRenderStatus(props.id)).toEqual(
        expect.objectContaining({ state: 'error', error: expect.objectContaining({ kind: 'data-limit' }) })
      );
    });

    it('reports a draw of an earlier input as not final', () => {
      const { props, rerender } = setup();
      rerender({ data: makeData([4, 5]) });
      act(() => latestController().handlers.onRenderComplete({ seq: 1, durationMs: 1, nodeCount: 2 }));
      expect(getPanelRenderStatus(props.id)).toEqual(expect.objectContaining({ state: 'drawn', final: false }));

      act(() => latestController().handlers.onRenderComplete({ seq: 2, durationMs: 1, nodeCount: 2 }));
      expect(getPanelRenderStatus(props.id)).toEqual(expect.objectContaining({ state: 'drawn', final: true }));
    });

    it('reports the panel paused while it is out of view', () => {
      let observe: IntersectionObserverCallback = () => {};
      const original = window.IntersectionObserver;
      window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
        observe = callback;
        return { observe: jest.fn(), disconnect: jest.fn() };
      }) as unknown as typeof IntersectionObserver;
      try {
        const { props } = setup();
        const toggle = (isIntersecting: boolean) =>
          act(() => observe([{ isIntersecting } as IntersectionObserverEntry], {} as unknown as IntersectionObserver));

        toggle(false);
        expect(latestController().pause).toHaveBeenCalled();
        expect(getPanelRenderStatus(props.id)).toEqual(expect.objectContaining({ state: 'pending', paused: true }));

        toggle(true);
        expect(getPanelRenderStatus(props.id)?.paused).toBeUndefined();
      } finally {
        window.IntersectionObserver = original;
      }
    });

    it('reports under the scene key of the panel element, which tells repeat clones apart', () => {
      const props = getPanelProps<Options>({ code: CODE }, { data: makeData([1]) });
      render(
        <div data-viz-panel-key="panel-6-clone-1">
          <CustomPanel {...props} />
        </div>
      );
      expect(getPanelRenderStatuses(props.id)).toEqual([expect.objectContaining({ instanceKey: 'panel-6-clone-1' })]);
    });

    it('keeps the shape of the data it sent to the drawing', () => {
      const { props } = setup();
      expect(getPanelRenderData(props.id)).toEqual({
        frames: [
          {
            refId: 'A',
            length: 3,
            fields: [expect.objectContaining({ name: 'value', type: 'number', displayName: 'value' })],
          },
        ],
      });
    });

    it('captures the drawing through the frame and stops reporting on unmount', async () => {
      const { props, unmount } = setup();
      await expect(capturePanelRender(props.id)).resolves.toBe('data:image/png;base64,AA==');
      expect(latestController().capture).toHaveBeenCalled();

      unmount();
      expect(getPanelRenderStatus(props.id)).toBeUndefined();
    });
  });
});
