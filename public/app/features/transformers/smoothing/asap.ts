import { ASAP } from 'downsample';

export interface DataPoint {
  x: number;
  y: number;
}

export interface ASAPOptions {
  resolution: number;
}

export function asapSmooth(data: Array<DataPoint | [number, number]>, options: ASAPOptions): DataPoint[] {
  const { resolution } = options;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const inputData: Array<[number, number]> = [];

  for (const point of data) {
    if (!point || typeof point !== 'object') {
      continue;
    }

    let x: number, y: number;

    if ('x' in point && 'y' in point) {
      x = typeof point.x === 'number' ? point.x : Number(point.x);
      y = typeof point.y === 'number' ? point.y : Number(point.y);
    } else if (Array.isArray(point) && point.length >= 2) {
      x = Number(point[0]);
      y = Number(point[1]);
    } else {
      continue;
    }

    if (isNaN(x) || isNaN(y)) {
      continue;
    }

    inputData.push([x, y]);
  }

  if (inputData.length === 0) {
    return [];
  }

  const smoothedData = ASAP(inputData, resolution);

  const result: DataPoint[] = [];
  for (let i = 0; i < smoothedData.length; i++) {
    const item = smoothedData[i];

    if (Array.isArray(item) && item.length >= 2) {
      result.push({ x: Number(item[0]), y: Number(item[1]) });
    } else if (item && typeof item === 'object' && 'x' in item && 'y' in item) {
      result.push({ x: Number(item.x), y: Number(item.y) });
    }
  }

  return result;
}
