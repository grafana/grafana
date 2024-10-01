import { includes, isDate } from 'lodash';

import { TimeZone } from '../types/time';

import {
  DateTime,
  dateTime,
  dateTimeAsMoment,
  dateTimeForTimeZone,
  DurationUnit,
  isDateTime,
  ISO_8601,
} from './moment_wrapper';

const units: DurationUnit[] = ['y', 'M', 'w', 'd', 'h', 'm', 's', 'Q'];

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

  if (typeof text !== 'string') {
    if (isDateTime(text)) {
      return text;
    }

    if (isDate(text)) {
      return dateTime(text);
    }

    // We got some non string which is not a moment nor Date. TS should be able to check for that but not always.
    return undefined;
  } else {
    let time: DateTime;
    let mathString = '';
    let index = -1;
    let parseString = '';

    if (text.substring(0, 3) === 'now') {
      time = dateTimeForTimeZone(timezone);
      mathString = text.substring('now'.length);
    } else {
      index = text.indexOf('||');
      if (index === -1) {
        parseString = text;
        mathString = ''; // nothing else
      } else {
        parseString = text.substring(0, index);
        mathString = text.substring(index + 2);
      }
      // We're going to just require ISO8601 timestamps, k?
      time = dateTime(parseString, ISO_8601);
    }

    if (!mathString.length) {
      return time;
    }

    return parseDateMath(mathString, time, roundUp, fiscalYearStartMonth);
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

    const unit = unitString as DurationUnit;

    if (!includes(units, unit)) {
      return undefined;
    } else {
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
