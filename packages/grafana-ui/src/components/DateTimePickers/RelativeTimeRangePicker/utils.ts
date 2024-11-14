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

  const absoluteSeconds = Math.abs(seconds);
  if (seconds < 0) {
    return `now+${formatDuration(absoluteSeconds)}`;
  }

  return `now-${formatDuration(absoluteSeconds)}`;
};

/**
 * Formats the given duration in seconds into a human-readable string representation.
 *
 * @param seconds - The duration in seconds.
 * @returns The formatted duration string.
 */
function formatDuration(seconds: number): string {
  const units = [
    { unit: 'w', value: 7 * 24 * 60 * 60 },
    { unit: 'd', value: 24 * 60 * 60 },
    { unit: 'h', value: 60 * 60 },
    { unit: 'm', value: 60 },
    { unit: 's', value: 1 },
  ];

  for (const { unit, value } of units) {
    if (seconds % value === 0) {
      const quotient = seconds / value;
      return `${quotient}${unit}`;
    }
  }

  // If no perfect division, use the least significant unit
  const leastSignificant = units[units.length - 1];
  return `${seconds}${leastSignificant.unit}`;
}
