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
  if (range.to > 0) {
    return {
      from: secondsToRelativeFormat(range.from),
      to: secondsToRelativeFormat(range.to),
      display: `Last ${formatToOptionDisplay(range.from)}, ${formatToOptionDisplay(range.to)} ago`,
    };
  }

  return {
    from: secondsToRelativeFormat(range.from),
    to: secondsToRelativeFormat(range.to),
    display: `Last ${formatToOptionDisplay(range.from)}`,
  };
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

type UnitKeys = keyof typeof units;

const displayUnit: Record<UnitKeys, string> = {
  y: 'year',
  M: 'month',
  w: 'week',
  d: 'day',
  h: 'hour',
  m: 'minute',
  s: 'second',
};

const formatToOptionDisplay = (seconds: number): string => {
  if (seconds <= 0) {
    return '';
  }

  if (seconds >= units.y) {
    return formatWithMaxTwoUnits(seconds, 'y', 'M');
  }

  if (seconds >= units.M) {
    return formatWithMaxTwoUnits(seconds, 'M', 'w');
  }

  if (seconds >= units.w) {
    return formatWithMaxTwoUnits(seconds, 'w', 'd');
  }

  if (seconds >= units.d) {
    return formatWithMaxTwoUnits(seconds, 'd', 'h');
  }

  if (seconds >= units.h) {
    return formatWithMaxTwoUnits(seconds, 'h', 'm');
  }

  if (seconds >= units.m) {
    return formatWithMaxTwoUnits(seconds, 'm', 's');
  }

  return formatWithUnit(seconds, 'second');
};

const formatWithMaxTwoUnits = (seconds: number, firstUnit: UnitKeys, secondUnit: UnitKeys): string => {
  const left = seconds % units[firstUnit];
  const amount = Math.floor(seconds / units[firstUnit]);

  if (left < units[secondUnit]) {
    return formatWithUnit(amount, displayUnit[firstUnit]);
  }

  const amountLeft = Math.floor(left / units[secondUnit]);
  return `${formatWithUnit(amount, displayUnit[firstUnit])} and ${formatWithUnit(amountLeft, displayUnit[secondUnit])}`;
};

const formatWithUnit = (amount: number, unit: string): string => {
  const suffix = amount > 1 ? 's' : '';
  return `${amount} ${unit}${suffix}`;
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
