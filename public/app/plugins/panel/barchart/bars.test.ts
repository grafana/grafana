import uPlot from 'uplot';

import { ScaleOrientation } from '@grafana/schema';

import { populateMarkerList } from './bars';
import { PreparedMarker, MarkerDrawingArgs } from './markerTypes';

describe('populateMarkerList', () => {
  const mockValToPos = jest.fn((val: number) => val * 10);
  const mockUplot: uPlot = {
    valToPos: mockValToPos,
    bbox: {
      left: 10,
      top: 5,
      width: 200,
      height: 100,
    },
  } as any;

  const baseMarker: PreparedMarker = {
    seriesIdx: 1,
    groupIdx: 0,
    yScaleKey: 'y-scale',
    yValue: 5,
    opts: {
      label: 'test-marker',
      shape: 'circle',
      color: 'red',
      size: 0.1,
      opacity: 1,
    },
  };

  beforeEach(() => {
    mockValToPos.mockClear();
  });

  it('should return an empty array if no markers are provided', () => {
    const result = populateMarkerList([], 0, 1, ScaleOrientation.Horizontal, 10, 20, mockUplot, 10, 20);
    expect(result).toEqual([]);
  });

  it('should return an empty array if no markers match the data and series index', () => {
    const markers: PreparedMarker[] = [baseMarker];
    const result = populateMarkerList(markers, 99, 99, ScaleOrientation.Horizontal, 10, 20, mockUplot, 10, 20);
    expect(result).toEqual([]);
  });

  describe('Horizontal Orientation', () => {
    const xOri = ScaleOrientation.Horizontal;

    it('should correctly resolve a matching marker', () => {
      const markers: PreparedMarker[] = [baseMarker];
      const result = populateMarkerList(markers, 0, 1, xOri, 100, 100, mockUplot, 20, 25);

      expect(result).toHaveLength(1);
      const resolvedMarker: MarkerDrawingArgs = result[0];

      expect(mockValToPos).toHaveBeenCalledWith(5, 'y-scale', true);
      // markerX = barX + wid/2 = 20 + 100/2 = 70
      expect(resolvedMarker.x).toBe(70);
      // resolvedY = u.valToPos(...) = 50
      expect(resolvedMarker.y).toBe(50);
      expect(resolvedMarker.isRotated).toBe(false);
      expect(resolvedMarker.opts).toEqual({
        ...baseMarker.opts,
        size: baseMarker.opts.size * 100, // opts.size * wid
      });
    });

    it('should handle markers with no valid yValue or yScaleKey', () => {
      const markers: PreparedMarker[] = [
        { ...baseMarker, yValue: null as any },
        { ...baseMarker, yScaleKey: '' },
      ];
      const result = populateMarkerList(markers, 0, 1, xOri, 10, 20, mockUplot, 10, 20);

      expect(result).toHaveLength(2);
      expect(result[0].y).toBe(Infinity);
      expect(result[1].y).toBe(Infinity);
      expect(mockValToPos).not.toHaveBeenCalled();
    });
  });

  describe('Vertical Orientation', () => {
    const xOri = ScaleOrientation.Vertical;

    it('should correctly resolve a matching marker', () => {
      const markers: PreparedMarker[] = [baseMarker];
      const result = populateMarkerList(markers, 0, 1, xOri, 50, 50, mockUplot, 20, 25);

      expect(result).toHaveLength(1);
      const resolvedMarker: MarkerDrawingArgs = result[0];

      expect(mockValToPos).toHaveBeenCalledWith(5, 'y-scale', true);
      // resolvedX = u.valToPos(...) = 50
      expect(resolvedMarker.x).toBe(50);
      // markerY = barY + hgt/2 = 25 + 50/2 = 50
      expect(resolvedMarker.y).toBe(50);
      expect(resolvedMarker.isRotated).toBe(true);
      expect(resolvedMarker.opts).toEqual({
        ...baseMarker.opts,
        size: baseMarker.opts.size * 50, // opts.size * hgt
      });
    });

    it('should handle markers with no valid yValue or yScaleKey', () => {
      const markers: PreparedMarker[] = [
        { ...baseMarker, yValue: null as any },
        { ...baseMarker, yScaleKey: '' },
      ];
      const result = populateMarkerList(markers, 0, 1, xOri, 10, 20, mockUplot, 10, 20);

      expect(result).toHaveLength(2);
      expect(result[0].x).toBe(Infinity);
      expect(result[1].x).toBe(Infinity);
      expect(mockValToPos).not.toHaveBeenCalled();
    });
  });

  it('should resolve multiple matching markers', () => {
    const markers: PreparedMarker[] = [
      baseMarker,
      { ...baseMarker, yValue: 8, opts: { ...baseMarker.opts, color: 'blue' } },
    ];
    const result = populateMarkerList(markers, 0, 1, ScaleOrientation.Horizontal, 10, 20, mockUplot, 10, 20);

    expect(result).toHaveLength(2);
    expect(mockValToPos).toHaveBeenCalledTimes(2);
    expect(mockValToPos).toHaveBeenCalledWith(5, 'y-scale', true);
    expect(mockValToPos).toHaveBeenCalledWith(8, 'y-scale', true);

    expect(result[0].y).toBe(50);
    expect(result[1].y).toBe(80);
    expect(result[0].x).toBe(15);
    expect(result[1].x).toBe(15);
  });
});
