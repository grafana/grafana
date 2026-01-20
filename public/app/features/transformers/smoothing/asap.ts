import { ASAP } from 'downsample';

export interface DataPoint {
  x: number;
  y: number;
}

export interface ASAPOptions {
  resolution: number;
}

export function asapSmooth(data: DataPoint[], options: ASAPOptions): DataPoint[] {
  const { resolution } = options;

  if (!data || data.length === 0) {
    return [];
  }

  // Filter invalid points and convert to tuple format for ASAP library
  const inputData: Array<[number, number]> = data
    .filter((point) => point != null && !isNaN(point.x) && !isNaN(point.y))
    .map((point) => [point.x, point.y]);

  if (inputData.length === 0) {
    return [];
  }

  // this prevents O(m×n) degradation if inputData is unsorted data
  inputData.sort((a, b) => a[0] - b[0]);

  // ASAP always returns objects with x and y properties
  const smoothedData = ASAP(inputData, resolution);

  // Convert back to DataPoint format
  const result: DataPoint[] = Array.from(smoothedData).filter(
    (item): item is DataPoint => item !== null && typeof item === 'object' && 'x' in item && 'y' in item
  );

  return result;
}
