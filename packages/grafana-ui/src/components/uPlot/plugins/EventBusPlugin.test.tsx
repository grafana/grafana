import { render } from '@testing-library/react';
import { Subscription } from 'rxjs';
import type uPlot from 'uplot';

import { DataHoverClearEvent, DataHoverEvent, EventBusSrv, LegacyGraphHoverEvent } from '@grafana/data';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { EventBusPlugin } from './EventBusPlugin';

import SpyInstance = jest.SpyInstance;

describe('EventBusPlugin', () => {
  const config = new UPlotConfigBuilder();
  const eventBus = new EventBusSrv();
  let addHookSpy: SpyInstance;
  let getStreamSpy: SpyInstance;

  beforeEach(() => {
    addHookSpy = jest.spyOn(config, 'addHook');
    getStreamSpy = jest.spyOn(eventBus, 'getStream');
  });

  afterEach(() => {
    getStreamSpy.mockRestore();
    addHookSpy.mockRestore();
  });

  it('registers uPlot hooks', () => {
    render(<EventBusPlugin config={config} eventBus={eventBus} />);

    expect(addHookSpy).toHaveBeenCalledWith('init', expect.any(Function));
    expect(addHookSpy).toHaveBeenCalledWith('setSeries', expect.any(Function));
    expect(addHookSpy).toHaveBeenCalledWith('setLegend', expect.any(Function));
  });

  it('subscribes to eventBus events', () => {
    render(<EventBusPlugin config={config} eventBus={eventBus} />);

    expect(getStreamSpy).toHaveBeenCalledWith(DataHoverEvent);
    expect(getStreamSpy).toHaveBeenCalledWith(LegacyGraphHoverEvent);
    expect(getStreamSpy).toHaveBeenCalledWith(DataHoverClearEvent);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribeSpy = jest.spyOn(Subscription.prototype, 'unsubscribe');

    const { unmount } = render(<EventBusPlugin config={config} eventBus={eventBus} />);

    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
    expect(unsubscribeSpy).toHaveBeenCalled();
    unsubscribeSpy.mockRestore();
  });

  describe('handleCursorUpdate', () => {
    const height = 400;
    const time = 42;
    const left = 123;
    const valToPos = jest.fn(() => left);
    const setCursor = jest.fn();
    const initUPlot = (uPlotOverrides?: Partial<uPlot>) => {
      const mockU = {
        valToPos,
        setCursor,
        rect: { height },
        cursor: { _lock: false },
        ...uPlotOverrides,
      } as unknown as uPlot;
      const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;
      expect(initCallback).toBeDefined();
      initCallback(mockU);
    };

    beforeEach(() => {
      setCursor.mockClear();
    });

    it('DataHoverEvent external hover', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot();
      eventBus.publish(
        new DataHoverEvent({
          point: { time },
        })
      );

      expect(valToPos).toHaveBeenCalledWith(time, 'x');
      expect(setCursor).toHaveBeenCalledWith({ left, top: height / 2 });
    });
    it('LegacyGraphHoverEvent external hover', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot();
      eventBus.publish(
        new LegacyGraphHoverEvent({
          point: { time },
          pos: { offset: { left: 0 } },
          panel: { id: 1 },
        })
      );

      expect(valToPos).toHaveBeenCalledWith(time, 'x');
      expect(setCursor).toHaveBeenCalledWith({ left, top: height / 2 });
    });
    it('DataHoverClearEvent: unlocked', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot();
      eventBus.publish(new DataHoverClearEvent());
      expect(setCursor).toHaveBeenCalledWith({ left: -10, top: -10 });
    });
    it('DataHoverClearEvent: locked', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot({ cursor: { _lock: true } } as unknown as uPlot);
      eventBus.publish(new DataHoverClearEvent());
      expect(setCursor).not.toHaveBeenCalled();
    });
  });

  describe('setLegend', () => {
    it.todo('throttles hoverEvent');
    it.todo('throttles clearEvent');
  });
});
