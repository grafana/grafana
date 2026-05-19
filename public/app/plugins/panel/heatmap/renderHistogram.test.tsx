import { renderHistogram } from './renderHistogram';

describe('renderHistogram', () => {
  const histCanWidth = 100;
  const histCanHeight = 50;
  const yBucketCount = 3;

  let mockClearRect: jest.Mock;
  let mockFill: jest.Mock;
  let mockRect: jest.Mock;
  let canvasRef: React.RefObject<HTMLCanvasElement | null>;

  beforeEach(() => {
    mockClearRect = jest.fn();
    mockFill = jest.fn();
    mockRect = jest.fn();

    const mockPath2D = jest.fn().mockImplementation(() => ({
      rect: mockRect,
    }));

    const mockCtx = {
      clearRect: mockClearRect,
      fillStyle: '',
      fill: mockFill,
    };

    Object.defineProperty(global, 'Path2D', {
      value: mockPath2D,
      writable: true,
      configurable: true,
    });

    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
    canvasRef = { current: canvas };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when canvas ref is null', () => {
    const nullRef = { current: null };
    renderHistogram(nullRef, histCanWidth, histCanHeight, [1000], [5], 0, yBucketCount);

    expect(mockClearRect).not.toHaveBeenCalled();
    expect(mockFill).not.toHaveBeenCalled();
  });

  it('does nothing when getContext returns null', () => {
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'getContext').mockReturnValue(null);
    const ref = { current: canvas };

    renderHistogram(ref, histCanWidth, histCanHeight, [1000], [5], 0, yBucketCount);

    expect(mockClearRect).not.toHaveBeenCalled();
    expect(mockFill).not.toHaveBeenCalled();
  });

  it('clears canvas and draws bars when context is available', () => {
    const xVals = [1000, 1000, 1000, 2000, 2000, 2000];
    const countVals = [5, 10, 15, 10, 20, 25];

    renderHistogram(canvasRef, histCanWidth, histCanHeight, xVals, countVals, 1, yBucketCount);

    expect(mockClearRect).toHaveBeenCalledWith(0, 0, histCanWidth, histCanHeight);
    expect(mockFill).toHaveBeenCalledTimes(2);
  });

  it('finds correct fromIdx when index is in middle of same-x run', () => {
    const xVals = [1000, 1000, 1000, 2000, 2000, 2000];
    const countVals = [5, 10, 15, 10, 20, 25];

    renderHistogram(canvasRef, histCanWidth, histCanHeight, xVals, countVals, 1, yBucketCount);

    expect(mockRect).toHaveBeenCalled();
    expect(mockClearRect).toHaveBeenCalled();
  });

  it('skips bars with zero count', () => {
    const xVals = [1000, 1000, 1000];
    const countVals = [5, 0, 15];

    renderHistogram(canvasRef, histCanWidth, histCanHeight, xVals, countVals, 0, yBucketCount);

    expect(mockClearRect).toHaveBeenCalled();
    expect(mockFill).toHaveBeenCalled();
  });

  it('handles single bar at index', () => {
    const xVals = [1000];
    const countVals = [10];

    renderHistogram(canvasRef, histCanWidth, histCanHeight, xVals, countVals, 0, 1);

    expect(mockClearRect).toHaveBeenCalledWith(0, 0, histCanWidth, histCanHeight);
    expect(mockRect).toHaveBeenCalled();
    expect(mockFill).toHaveBeenCalledTimes(2);
  });
});
