import { dateMath, dateTime, RelativeTimeRange, TimeOption } from '@grafana/data';

export const mapOptionToRelativeTimeRange = (option: TimeOption): RelativeTimeRange | undefined => {
  const now = dateTime().unix();
  const from = dateMath.parse(option.from)?.unix();
  const to = dateMath.parse(option.to)?.unix();

  if (!from || !to) {
    return;
  }

  return {
    from: now - from,
    to: now - to,
  };
};

export const mapRelativeTimeRangeToOption = (range: RelativeTimeRange): TimeOption => {
  const from = secondsToRelativeFormat(range.from);
  const to = secondsToRelativeFormat(range.to);

  return { from, to, display: `${from} to ${to}` };
};

const units: Record<string, number> = {
  y: 31536000,
  M: 2592000,
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

const secondsToRelativeFormat = (seconds: number): string => {
  if (seconds <= 0) {
    return 'now';
  }

  if (seconds >= units.y && seconds % units.y === 0) {
    return `now-${seconds / units.y}y`;
  }

  if (seconds >= units.M && seconds % units.M === 0) {
    return `now-${seconds / units.M}M`;
  }

  if (seconds >= units.w && seconds % units.w === 0) {
    return `now-${seconds / units.w}w`;
  }

  if (seconds >= units.d && seconds % units.d === 0) {
    return `now-${seconds / units.d}d`;
  }

  if (seconds >= units.h && seconds % units.h === 0) {
    return `now-${seconds / units.h}h`;
  }

  if (seconds >= units.m && seconds % units.m === 0) {
    return `now-${seconds / units.m}m`;
  }

  return `now-${seconds}s`;
};
