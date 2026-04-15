import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

// @ts-ignore jest-canvas-mock import fixes type errors in IDE
let unused = {} as unknown as CanvasRenderingContext2DEvent;

let lastUPlotConfig: { width: number; height: number } | null = null;

jest.mock('uplot', () => {
  return jest.fn().mockImplementation((config: { width?: number; height?: number }) => {
    lastUPlotConfig = { width: config?.width ?? 0, height: config?.height ?? 0 };
    const actual = jest.requireActual('uPlot');
    return {
      ...actual,
      setData: jest.fn().mockImplementation(actual.setData),
      setSize: jest.fn().mockImplementation(actual.setSize),
      destroy: jest.fn().mockImplementation(actual.destroy),
      paths: jest.fn().mockImplementation(actual.paths),
      rangeLog: jest.fn((min: number, max: number) => [min, max]),
    };
  });
});

describe('drawMarkers', () => {
  beforeEach(() => {
    lastUPlotConfig = null;
  });

  it('should render price paths without throwing and fill the canvas', () => {
    const top = 0;
    const left = 0;
    const height = 100;
    const width = 50;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const fillSpy = jest.spyOn(ctx, 'fill');
    const upColor = '#00ff00';
    const downColor = '#ff0000';

    const draw = drawMarkers({
      mode: VizDisplayMode.Candles,
      candleStyle: CandleStyle.Candles,
      colorStrategy: ColorStrategy.OpenClose,
      fields: { open: 1, high: 2, low: 3, close: 4 },
      upColor,
      downColor,
      flatColor: '#888888',
      volumeAlpha: 0.5,
      flatAsUp: true,
    });

    const u = new uPlot(
      {
        height,
        width,
        series: [
          { idxs: [0, 0], scale: 'x' },
          { scale: 'y' },
          { scale: 'y' },
          { scale: 'y' },
          { scale: 'y' },
        ] as uPlot.Series[],
      },
      [[1000], [10], [15], [5], [12]]
    );

    expect(() => draw(u)).not.toThrow();

    const events = ctx.__getEvents();
    const transform = [1, 0, 0, 1, 0, 0];
    expect(events).toMatchObject([
      { transform, type: 'save' },
      { props: { height, width, x: 0, y: 0 }, transform, type: 'rect' },
      {
        props: {
          fillRule: 'nonzero',
          path: [
            { props: {}, transform, type: 'beginPath' },
            { props: { height, width, x: 0, y: 0 }, transform, type: 'rect' },
          ],
        },
        transform,
        type: 'clip',
      },
      { props: { value: upColor }, transform, type: 'fillStyle' },
      {
        props: {
          fillRule: 'nonzero',
          path: [
            { props: { height: 10, width: 2, x: 49, y: 85 }, transform, type: 'rect' },
            { props: { height: 2, width: 60, x: 20, y: 88 }, transform, type: 'rect' },
          ],
        },
        transform,
        type: 'fill',
      },
      { props: { value: downColor }, transform, type: 'fillStyle' },
      { props: { fillRule: 'nonzero', path: [] }, transform, type: 'fill' },
      { props: { value: '#888888' }, transform, type: 'fillStyle' },
      { props: { fillRule: 'nonzero', path: [] }, transform, type: 'fill' },
      { props: { value: 'destination-out' }, transform, type: 'globalCompositeOperation' },
      { props: { fillRule: 'nonzero', path: [] }, transform, type: 'fill' },
      { props: {}, transform, type: 'restore' },
    ]);

    fillSpy.mockRestore();
  });
});
