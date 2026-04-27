import { render } from '@testing-library/react';
import { Subscription } from 'rxjs';
import type uPlot from 'uplot';

import { DataHoverClearEvent, DataHoverEvent, EventBusSrv } from '@grafana/data/events';
import { LegacyGraphHoverEvent } from '@grafana/data/types';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { EventBusPlugin } from './EventBusPlugin';

import SpyInstance = jest.SpyInstance;

describe('EventBusPlugin', () => {
  let config: UPlotConfigBuilder;
  let eventBus: EventBusSrv;
  let addHookSpy: SpyInstance;
  let getStreamSpy: SpyInstance;

  beforeEach(() => {
    config = new UPlotConfigBuilder();
    eventBus = new EventBusSrv();
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
    // Prototype spy: restored before this test ends so other suites are unaffected.
    const unsubscribeSpy = jest.spyOn(Subscription.prototype, 'unsubscribe');

    const { unmount } = render(<EventBusPlugin config={config} eventBus={eventBus} />);

    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
    expect(unsubscribeSpy).toHaveBeenCalled();
    unsubscribeSpy.mockRestore();
  });

  it('registers hooks again when config instance changes', () => {
    const first = new UPlotConfigBuilder();
    const second = new UPlotConfigBuilder();
    const bus = new EventBusSrv();
    const spyFirst = jest.spyOn(first, 'addHook');
    const spySecond = jest.spyOn(second, 'addHook');

    const { rerender } = render(<EventBusPlugin config={first} eventBus={bus} />);

    expect(spyFirst).toHaveBeenCalledWith('init', expect.any(Function));

    rerender(<EventBusPlugin config={second} eventBus={bus} />);

    expect(spySecond).toHaveBeenCalledWith('init', expect.any(Function));

    spyFirst.mockRestore();
    spySecond.mockRestore();
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
      const initCallback = addHookSpy.mock.calls.filter((call) => call[0] === 'init').at(-1)?.[1] as (u: uPlot) => void;
      expect(initCallback).toBeDefined();
      initCallback(mockU);
    };

    beforeEach(() => {
      setCursor.mockClear();
      valToPos.mockClear();
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

    it('ignores uPlot DataHoverEvent external hover', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot();
      eventBus.publish(
        new DataHoverEvent({
          point: { time },
        }).setTags(['uplot'])
      );

      expect(valToPos).not.toHaveBeenCalled();
      expect(setCursor).not.toHaveBeenCalled();
    });

    it('ignores uPlot DataHoverClearEvent', () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initUPlot();
      eventBus.publish(new DataHoverClearEvent().setTags(['uplot']));
      expect(setCursor).not.toHaveBeenCalled();
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

  describe('legend config', () => {
    let config: UPlotConfigBuilder;
    let eventBus: EventBusSrv;
    let publishSpy: jest.SpyInstance;
    let addHookSpy: jest.SpyInstance;
    let initCallback: (u: uPlot) => void, setLegendCallback: () => void, clearPublishes: () => void;

    const mockU = {
      cursor: {
        event: {},
        idxs: [2],
        top: 100,
      },
      data: [[10, 20, 30, 40, 50]],
      rect: { height: 400 },
    } as unknown as uPlot;

    const emitLegendEvents = () => {
      setLegendCallback();
      setLegendCallback();
      setLegendCallback();
    };

    const renderHelper = () => {
      render(<EventBusPlugin config={config} eventBus={eventBus} />);
      initCallback = addHookSpy.mock.calls.filter((call) => call[0] === 'init').at(-1)?.[1] as (u: uPlot) => void;
      setLegendCallback = addHookSpy.mock.calls.filter((call) => call[0] === 'setLegend').at(-1)?.[1] as () => void;
      clearPublishes = () =>
        publishSpy.mock.calls.filter((call) => call[0] instanceof DataHoverClearEvent && call[0].tags?.has('uplot'));
    };

    beforeEach(() => {
      jest.useFakeTimers();
      config = new UPlotConfigBuilder();
      eventBus = new EventBusSrv();
      publishSpy = jest.spyOn(eventBus, 'publish');
      addHookSpy = jest.spyOn(config, 'addHook');
    });

    afterEach(() => {
      publishSpy.mockRestore();
      addHookSpy.mockRestore();
      jest.useRealTimers();
    });

    it('throttles hoverEvent', () => {
      renderHelper();
      initCallback(mockU);
      emitLegendEvents();
      const hoverPublishes = () => publishSpy.mock.calls;
      expect(hoverPublishes()).toHaveLength(1);
      jest.advanceTimersByTime(100);
      expect(hoverPublishes()).toHaveLength(2);
    });
    it('throttles clearEvent', () => {
      renderHelper();
      const mockU = {
        cursor: {
          event: {},
          idxs: [null, null],
          top: 100,
        },
        data: [[10, 20, 30]],
        rect: { height: 400 },
      } as unknown as uPlot;

      initCallback(mockU);
      emitLegendEvents();

      expect(clearPublishes()).toHaveLength(1);
      jest.advanceTimersByTime(100);
      expect(clearPublishes()).toHaveLength(2);
    });
  });
});
