import { Units } from '../util/format';
import { deltaDiffWrapper } from '../../flamebearer';

export type Flamebearer = {
  /**
   * List of names
   */
  names: string[];
  /**
   * List of level
   *
   * This is NOT the same as in the flamebearer
   * that we receive from the server.
   * As in there are some transformations required
   * (see deltaDiffWrapper)
   */
  levels: number[][];
  numTicks: number;
  /**
   * Sample Rate, used in text information
   */
  sampleRate: number;
  units: Units;
  spyName: 'dotneyspy' | 'ebpfspy' | 'gospy' | 'phpspy' | 'pyspy' | 'rbspy' | string;
} & addTicks;

export type addTicks = { format: 'double'; leftTicks: number; rightTicks: number } | { format: 'single' };

interface DecodeFlamebearerProps {
  flamebearer: Flamebearer;
  metadata: {
    format: 'single' | 'double';
    spyName: string;
    sampleRate: number;
    units: Units;
  };
  leftTicks?: number;
  rightTicks?: number;
  version?: number;
}

// Hopefully these type assertions won't be required once we enable strictNullChecks in the ompiler
export function decodeFlamebearer({
  flamebearer,
  metadata,
  leftTicks,
  rightTicks,
}: DecodeFlamebearerProps): Flamebearer {
  const fb = {
    ...flamebearer,
    format: metadata.format,
    spyName: metadata.spyName,
    sampleRate: metadata.sampleRate,
    units: metadata.units,
  };

  if (fb.format === 'double') {
    (fb as any).leftTicks = leftTicks;
    (fb as any).rightTicks = rightTicks;
  }

  fb.levels = deltaDiffWrapper(fb.format, fb.levels);
  return fb as Flamebearer;
}

export type FlamebearerProfile = {
  flamebearer: Flamebearer;

  /**
   * Format version.
   */
  version: number;

  metadata: {
    appName: string;
    startTime: string;
    endTime: string;
    query: string;
    maxNodes: number;
  };
};

// RawFlamebearerProfile represents the exact FlamebearerProfile it's gotten from the backend
export interface RawFlamebearerProfile {
  version: number;

  metadata: {
    // Optional fields since adhoc may be missing them
    // they are added on /render and /render-diff response
    // https://github.com/pyroscope-io/pyroscope/blob/main/pkg/server/render.go#L114-L131
    appName?: string;
    startTime?: number;
    endTime?: number;
    query?: string;
    maxNodes?: number;
  };

  flamebearer: {
    /**
     * List of names
     */
    names: string[];
    /**
     * List of level
     *
     * This is NOT the same as in the flamebearer
     * that we receive from the server.
     * As in there are some transformations required
     * (see deltaDiffWrapper)
     */
    levels: number[][];
    numTicks: number;
  };
}
