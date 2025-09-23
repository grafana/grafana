import { isDate } from 'lodash';

import { TimeZone } from '@grafana/schema';

import {
  DateTime,
  dateTime,
  dateTimeAsMoment,
  dateTimeForTimeZone,
  DateTimeInput,
  DurationUnit,
  isDateTime,
  ISO_8601,
} from './moment_wrapper';

const units: string[] = ['y', 'M', 'w', 'd', 'h', 'm', 's', 'Q'] satisfies DurationUnit[];

const isDurationUnit = (value: string): value is DurationUnit => {
  return units.includes(value);
};

/**
 * Determine if a string contains a relative date time.
 * @param text
 */
export function isMathString(text: string | DateTime | Date): boolean {
  if (!text) {
    return false;
  }

  if (typeof text === 'string' && (text.substring(0, 3) === 'now' || text.includes('||'))) {
    return true;
  } else {
    return false;
  }
}

/**
 * @deprecated use toDateTime instead
 * Parses different types input to a moment instance. There is a specific formatting language that can be used
 * if text arg is string. See unit tests for examples.
 * @param text
 * @param roundUp See parseDateMath function.
 * @param timezone Only string 'utc' is acceptable here, for anything else, local timezone is used.
 */
export function parse(
  text?: string | DateTime | Date | null,
  roundUp?: boolean,
  timezone?: TimeZone,
  fiscalYearStartMonth?: number
): DateTime | undefined {
  if (!text) {
    return undefined;
  }
  return toDateTime(text, { roundUp, timezone, fiscalYearStartMonth });
}

export interface ConversionOptions {
  /**
   * Set the time to endOf time unit, otherwise to startOf time unit.
   */
  roundUp?: boolean;
  /**
   * Only string 'utc' is acceptable here, for anything else, local timezone is used.
   */
  timezone?: TimeZone;
  /**
   * Setting for which month is the first month of the fiscal year.
   */
  fiscalYearStartMonth?: number;
  /**
   * DateTimeInput to use as now. Useful when parsing multiple values and now needs to be the same. Without this, comparing results from subsequent parses is not guaranteed to be deterministic.
   */
  now?: DateTimeInput;
}

/**
 * @param dateTimeRep A DateTime object, a Date object or a string representation of a specific time.
 * @param options Options for converting to DateTime
 * @returns A DateTime object if possible, undefined if not.
 */
export function toDateTime(dateTimeRep: string | DateTime | Date, options: ConversionOptions): DateTime | undefined {
  if (typeof dateTimeRep !== 'string') {
    if (isDateTime(dateTimeRep)) {
      return dateTimeRep;
    }

    if (isDate(dateTimeRep)) {
      return dateTime(dateTimeRep);
    }

    // We got some non string which is not a moment nor Date. TS should be able to check for that but not always.
    return undefined;
  } else {
    let time: DateTime;
    let mathString = '';
    let index = -1;
    let parseString = '';

    if (dateTimeRep.substring(0, 3) === 'now') {
      time = dateTimeForTimeZone(options.timezone, options.now);
      mathString = dateTimeRep.substring('now'.length);
    } else {
      index = dateTimeRep.indexOf('||');
      if (index === -1) {
        parseString = dateTimeRep;
        mathString = ''; // nothing else
      } else {
        parseString = dateTimeRep.substring(0, index);
        mathString = dateTimeRep.substring(index + 2);
      }
      // We're going to just require ISO8601 timestamps, k?
      time = dateTime(parseString, ISO_8601);
    }

    if (!mathString.length) {
      return time;
    }

    return parseDateMath(mathString, time, options.roundUp, options.fiscalYearStartMonth);
  }
}

/**
 * Checks if text is a valid date which in this context means that it is either a Moment instance or it can be parsed
 * by parse function. See parse function to see what is considered acceptable.
 * @param text
 */
export function isValid(text: string | DateTime): boolean {
  const date = parse(text);
  if (!date) {
    return false;
  }

  if (isDateTime(date)) {
    return date.isValid();
  }

  return false;
}

/**
 * Parses math part of the time string and shifts supplied time according to that math. See unit tests for examples.
 * @param mathString
 * @param time
 * @param roundUp If true it will round the time to endOf time unit, otherwise to startOf time unit.
 */
export function parseDateMath(
  mathString: string,
  time: DateTime,
  roundUp?: boolean,
  fiscalYearStartMonth = 0
): DateTime | undefined {
  const strippedMathString = mathString.replace(/\s/g, '');
  const result = dateTime(time);
  let i = 0;
  const len = strippedMathString.length;

  while (i < len) {
    const c = strippedMathString.charAt(i++);
    let type;
    let num;
    let unitString: string;
    let isFiscal = false;

    if (c === '/') {
      type = 0;
    } else if (c === '+') {
      type = 1;
    } else if (c === '-') {
      type = 2;
    } else {
      return undefined;
    }

    if (isNaN(parseInt(strippedMathString.charAt(i), 10))) {
      num = 1;
    } else if (strippedMathString.length === 2) {
      num = parseInt(strippedMathString.charAt(i), 10);
    } else {
      const numFrom = i;
      while (!isNaN(parseInt(strippedMathString.charAt(i), 10))) {
        i++;
        if (i > 10) {
          return undefined;
        }
      }
      num = parseInt(strippedMathString.substring(numFrom, i), 10);
    }

    if (type === 0) {
      // rounding is only allowed on whole, single, units (eg M or 1M, not 0.5M or 2M)
      if (num !== 1) {
        return undefined;
      }
    }

    unitString = strippedMathString.charAt(i++);

    if (unitString === 'f') {
      unitString = strippedMathString.charAt(i++);
      isFiscal = true;
    }

    const unit = unitString;

    if (isDurationUnit(unit)) {
      if (type === 0) {
        if (isFiscal) {
          roundToFiscal(fiscalYearStartMonth, result, unit, roundUp);
        } else {
          if (roundUp) {
            result.endOf(unit);
          } else {
            result.startOf(unit);
          }
        }
      } else if (type === 1) {
        result.add(num, unit);
      } else if (type === 2) {
        result.subtract(num, unit);
      }
    } else {
      return undefined;
    }
  }
  return result;
}

export function roundToFiscal(fyStartMonth: number, dateTime: DateTime, unit: string, roundUp: boolean | undefined) {
  switch (unit) {
    case 'y':
      if (roundUp) {
        roundToFiscal(fyStartMonth, dateTime, unit, false)?.add(11, 'M').endOf('M');
      } else {
        dateTime.subtract((dateTimeAsMoment(dateTime).month() - fyStartMonth + 12) % 12, 'M').startOf('M');
      }
      return dateTime;
    case 'Q':
      if (roundUp) {
        roundToFiscal(fyStartMonth, dateTime, unit, false)?.add(2, 'M').endOf('M');
      } else {
        // why + 12? to ensure this number is always a positive offset from fyStartMonth
        dateTime.subtract((dateTimeAsMoment(dateTime).month() - fyStartMonth + 12) % 3, 'M').startOf('M');
      }
      return dateTime;
    default:
      return undefined;
  }
}
