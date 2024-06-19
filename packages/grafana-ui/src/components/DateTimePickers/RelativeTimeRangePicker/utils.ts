import { RelativeTimeRange, TimeOption } from '@grafana/data';

const regex = /^now$|^now(\-|\+)(\d{1,10})([wdhms])$/;

export const mapOptionToRelativeTimeRange = (option: TimeOption): RelativeTimeRange | undefined => {
  return {
    from: relativeToSeconds(option.from),
    to: relativeToSeconds(option.to),
  };
};

export const mapRelativeTimeRangeToOption = (range: RelativeTimeRange): TimeOption => {
  const from = secondsToRelativeFormat(range.from);
  const to = secondsToRelativeFormat(range.to);

  return { from, to, display: `${from} to ${to}` };
};

export type RangeValidation = {
  isValid: boolean;
  errorMessage?: string;
};

export const isRangeValid = (relative: string, now = Date.now()): RangeValidation => {
  if (!isRelativeFormat(relative)) {
    return {
      isValid: false,
      errorMessage: 'Value not in relative time format.',
    };
  }

  const seconds = relativeToSeconds(relative);

  if (seconds > Math.ceil(now / 1000)) {
    return {
      isValid: false,
      errorMessage: 'Can not enter value prior to January 1, 1970.',
    };
  }

  return { isValid: true };
};

export const isRelativeFormat = (format: string): boolean => {
  return regex.test(format);
};

const relativeToSeconds = (relative: string): number => {
  const match = regex.exec(relative);

  if (!match || match.length !== 4) {
    return 0;
  }

  const [, sign, value, unit] = match;
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return 0;
  }

  const seconds = parsed * units[unit];
  return sign === '+' ? seconds * -1 : seconds;
};

const units: Record<string, number> = {
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

const secondsToRelativeFormat = (seconds: number): string => {
  if (seconds === 0) {
    return 'now';
  }

  if (seconds < 0) {
    return `now+${formatPrometheusDuration(Math.abs(seconds))}`;
  }

  return `now-${formatPrometheusDuration(Math.abs(seconds))}`;
};

/**
 * Formats the given duration in milliseconds into a human-readable string representation.
 *
 * @param milliseconds - The duration in milliseconds.
 * @returns The formatted duration string.
 */
export function formatPrometheusDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  // we'll make an exception here for 0, 0ms seems a bit weird
  if (seconds === 0) {
    return '0s';
  }

  const timeUnits: Array<[number, string]> = [
    [weeks % 52, 'w'],
    [(days % 365) - 7 * (weeks % 52), 'd'],
    [hours % 24, 'h'],
    [minutes % 60, 'm'],
    [seconds % 60, 's'],
  ];

  return (
    timeUnits
      // remove all 0 values
      .filter(([time]) => time > 0)
      // join time and unit
      .map(([time, unit]) => time + unit)
      .join('')
  );
}
