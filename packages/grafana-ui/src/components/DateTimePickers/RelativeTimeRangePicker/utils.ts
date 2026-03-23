import { RelativeTimeRange, TimeOption } from '@grafana/data';

const getRegex = (relativeToNow = true) => {
  return relativeToNow ? /^now$|^now(\-|\+)(\d{1,10})([wdhms])$/ : /^field$|^field(\-|\+)(\d{1,10})([wdhms])$/;
};

export const mapOptionToRelativeTimeRange = (option: TimeOption): RelativeTimeRange | undefined => {
  return {
    from: relativeToSeconds(option.from),
    to: relativeToSeconds(option.to),
  };
};

export const mapRelativeTimeRangeToOption = (range: RelativeTimeRange, isRelativeToNow = true): TimeOption => {
  const from = secondsToRelativeFormat(range.from, isRelativeToNow);
  const to = secondsToRelativeFormat(range.to, isRelativeToNow);

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

export const isRelativeFormat = (format: string, isRelativeToNow = true): boolean => {
  return getRegex(isRelativeToNow).test(format);
};

const relativeToSeconds = (relative: string, isRelativeToNow = true): number => {
  const match = getRegex(isRelativeToNow).exec(relative);

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

const secondsToRelativeFormat = (seconds: number, isRelativeToNow = true): string => {
  const baseTime = isRelativeToNow ? 'now' : 'field';
  if (seconds === 0) {
    return baseTime;
  }

  const absoluteSeconds = Math.abs(seconds);
  if (seconds < 0) {
    return `${baseTime}+${formatDuration(absoluteSeconds)}`;
  }

  return `${baseTime}-${formatDuration(absoluteSeconds)}`;
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
