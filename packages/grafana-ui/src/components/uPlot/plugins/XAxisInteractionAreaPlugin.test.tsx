import { act, render } from '@testing-library/react';
import type uPlot from 'uplot';

import { createTheme } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';

import { mockBoundingClientRect } from '../../../test-utils/mockDom';
import { UPlotChart } from '../Plot';
import { UPlotConfigBuilder, type UPlotConfigBuilder as UPlotConfigBuilderType } from '../config/UPlotConfigBuilder';

import { calculatePanRange, setupXAxisPan, XAxisInteractionAreaPlugin } from './XAxisInteractionAreaPlugin';

const asUPlot = (partial: Partial<uPlot>) => partial as uPlot;
const asConfigBuilder = (partial: Partial<UPlotConfigBuilderType>) => partial as UPlotConfigBuilderType;

const createMockXAxis = () => {
  const element = document.createElement('div');
  element.classList.add('u-axis');
  return element;
};

const createMockConfigBuilder = () => {
  return {
    setState: jest.fn(),
    getState: jest.fn(() => ({ isPanning: false })),
  } satisfies Partial<UPlotConfigBuilder>;
};

const createMockUPlot = (xAxisElement: HTMLElement) => {
  const root = document.createElement('div');
  root.appendChild(xAxisElement);

  const over = document.createElement('div');
  mockBoundingClientRect({ left: 0, top: 0, width: 800, height: 400 });

  return {
    root,
    over,
    bbox: { width: 800, height: 400, left: 0, top: 0 },
    scales: {
      x: {
        min: 1000,
        max: 2000,
        range: () => [1000, 2000],
      },
    },
    setScale: jest.fn(),
  } satisfies Partial<uPlot>;
};

describe('XAxisInteractionAreaPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePanRange', () => {
    it('should calculate pan range correctly for positive and negative drag', () => {
      const timeFrom = 1000;
      const timeTo = 2000;
      const plotWidth = 800;

      const dragRight100px = calculatePanRange(timeFrom, timeTo, 100, plotWidth);
      expect(dragRight100px.from).toBeCloseTo(875, 1);
      expect(dragRight100px.to).toBeCloseTo(1875, 1);

      const dragLeft100px = calculatePanRange(timeFrom, timeTo, -100, plotWidth);
      expect(dragLeft100px.from).toBeCloseTo(1125, 1);
      expect(dragLeft100px.to).toBeCloseTo(2125, 1);
    });

    it('should return original range when not dragged', () => {
      const noDrag = calculatePanRange(1000, 2000, 0, 800);
      expect(noDrag.from).toBe(1000);
      expect(noDrag.to).toBe(2000);
    });
  });

  describe('setupXAxisPan', () => {
    let mockQueryZoom: jest.Mock;
    let mockConfigBuilder: ReturnType<typeof createMockConfigBuilder>;
    let xAxisElement: HTMLElement;
    let mockUPlot: ReturnType<typeof createMockUPlot>;

    beforeEach(() => {
      mockQueryZoom = jest.fn();
      mockConfigBuilder = createMockConfigBuilder();
      xAxisElement = createMockXAxis();
      mockUPlot = createMockUPlot(xAxisElement);
      document.body.appendChild(mockUPlot.root!);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    it('should handle missing x-axis element gracefully', () => {
      const emptyRoot = document.createElement('div');
      const emptyUPlot = { ...mockUPlot, root: emptyRoot };

      expect(() => setupXAxisPan(asUPlot(emptyUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom)).not.toThrow();
    });

    it('should show grab cursor on hover and grabbing during drag', () => {
      setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

      xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
      expect(xAxisElement).toHaveStyle({ cursor: 'grab' });

      xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      expect(xAxisElement).toHaveStyle({ cursor: 'grabbing' });

      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));
      expect(xAxisElement).toHaveStyle({ cursor: 'grab' });
    });

    it('should update scale during drag and call queryZoom on completion', () => {
      setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

      xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));

      const expectedRange = calculatePanRange(1000, 2000, -50, 800);

      expect(mockUPlot.setScale).toHaveBeenCalledWith('x', {
        min: expectedRange.from,
        max: expectedRange.to,
      });

      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));

      expect(mockQueryZoom).toHaveBeenCalledWith(expectedRange);
    });

    it('should not call queryZoom when drag distance is below threshold', () => {
      setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

      xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 402, bubbles: true }));

      expect(mockQueryZoom).not.toHaveBeenCalled();
    });

    it('should set isPanning state during drag and mark isTimeRangePending on mouseup', () => {
      setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

      xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));

      const expectedRange = calculatePanRange(1000, 2000, -50, 800);

      expect(mockConfigBuilder.setState).toHaveBeenCalledWith({
        isPanning: true,
        min: expectedRange.from,
        max: expectedRange.to,
      });

      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));

      expect(mockConfigBuilder.setState).toHaveBeenCalledWith({
        isPanning: true,
        min: expectedRange.from,
        max: expectedRange.to,
        isTimeRangePending: true,
      });
    });

    it('should clear isPanning state immediately for small drags below threshold', () => {
      setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

      xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 402, bubbles: true }));

      expect(mockConfigBuilder.setState).toHaveBeenCalledWith({ isPanning: false });
    });
  });

  describe('event listeners', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('removes all event listeners on unmount, including document listeners during an active drag', () => {
      const runUnmountCleanupAssertions = (options: { midDrag: boolean }) => {
        const config = new UPlotConfigBuilder();
        const addHookSpy = jest.spyOn(config, 'addHook');
        const { unmount } = render(<XAxisInteractionAreaPlugin config={config} queryZoom={jest.fn()} />);

        const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;

        const xAxisElement = createMockXAxis();
        const mockU = createMockUPlot(xAxisElement);

        const removeSpy = jest.spyOn(xAxisElement, 'removeEventListener');
        const addSpy = jest.spyOn(xAxisElement, 'addEventListener');
        const docRemoveSpy = jest.spyOn(document, 'removeEventListener');
        const docAddSpy = jest.spyOn(document, 'addEventListener');

        initCallback(asUPlot(mockU));

        if (options.midDrag) {
          xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400 }));
        }

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledTimes(3);
        expect(addSpy).toHaveBeenCalledTimes(3);

        if (options.midDrag) {
          expect(docRemoveSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
          expect(docRemoveSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
          expect(docRemoveSpy).toHaveBeenCalledTimes(2);
          expect(docAddSpy).toHaveBeenCalledTimes(2);
        } else {
          expect(docRemoveSpy).not.toHaveBeenCalled();
        }

        removeSpy.mockRestore();
        docRemoveSpy.mockRestore();
        docAddSpy.mockRestore();
        docRemoveSpy.mockRestore();
      };

      runUnmountCleanupAssertions({ midDrag: false });
      runUnmountCleanupAssertions({ midDrag: true });
    });
  });

  // Real uPlot copies its hooks at construction, so these render the plugin inside a real UPlotChart instead of
  // calling the latest `init` callback registered on a spied config builder.
  describe('with a real uPlot instance', () => {
    const FROM_MS = Date.UTC(2025, 9, 2, 10);
    const TO_MS = Date.UTC(2025, 9, 2, 11);

    const createConfig = () => {
      const config = new UPlotConfigBuilder();
      config.addScale({
        scaleKey: 'x',
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        isTime: true,
        range: () => [FROM_MS, TO_MS],
      });
      config.addAxis({ scaleKey: 'x', isTime: true, placement: AxisPlacement.Bottom, theme: createTheme() });
      return config;
    };

    const chart = (config: UPlotConfigBuilder, queryZoom: (range: { from: number; to: number }) => void) => (
      <UPlotChart config={config} data={[[FROM_MS, TO_MS]]} width={800} height={400}>
        <XAxisInteractionAreaPlugin config={config} queryZoom={queryZoom} />
      </UPlotChart>
    );

    // uPlot sets its scales and bbox in a microtask after construction.
    const uPlotCommit = () => act(() => Promise.resolve());

    const dragXAxisBy = (dragPixels: number) => {
      const xAxis = document.querySelector('.u-axis')!;
      xAxis.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 + dragPixels, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 400 + dragPixels, bubbles: true }));
    };

    it('pans the x axis through the queryZoom it was mounted with, keeping the range span', async () => {
      const queryZoom = jest.fn();
      render(chart(createConfig(), queryZoom));
      await uPlotCommit();

      dragXAxisBy(-50);

      expect(queryZoom).toHaveBeenCalledTimes(1);
      const { from, to } = queryZoom.mock.calls[0][0];
      expect(to - from).toBeCloseTo(60 * 60 * 1000);
    });

    // Known bug: the effect depends on `queryZoom`, so a new callback with the same config runs the cleanup
    // (removing the pan listeners) and registers an `init` hook the existing plot never fires. Callers that
    // pass an unstable callback (e.g. PanelRenderer's `onChangeTimeRange = () => {}` default) lose panning
    // after the first rerender. Change to `it` once fixed.
    it.failing('pans through the latest queryZoom after the callback changes without a config change', async () => {
      const config = createConfig();
      const initialQueryZoom = jest.fn();
      const latestQueryZoom = jest.fn();
      const { rerender } = render(chart(config, initialQueryZoom));
      await uPlotCommit();

      rerender(chart(config, latestQueryZoom));
      dragXAxisBy(-50);

      expect(latestQueryZoom).toHaveBeenCalledTimes(1);
      expect(initialQueryZoom).not.toHaveBeenCalled();
    });
  });
});
