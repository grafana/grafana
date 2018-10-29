import moment from 'moment';

export function customTimeRangePicked(mode, range, dayShift, editTimeRaw) {
  if (range.type === 'shift') {
    switch (mode) {
      case 'shift':
        const shiftResult = shift(range, dayShift);
        return shiftResult;

      case 'shiftByDay':
        const shiftByDayResult = shiftByDay(range, editTimeRaw);
        return {
          range: range,
          dayShift: shiftByDayResult.dayShift,
        };

      default:
        console.log(mode, ' mode not supported');
        throw new Error('Unknown mode');
    }
  } else {
    console.log(range.type, ' time range handler does not exists');
    throw new TypeError('Unknown range type');
  }
}

export function customMove(direction, index, timeOption, dayShift) {
  if (rangeIsValid(timeOption[index])) {
    if (timeOption[index].type === 'shift') {
      const shiftMoveResult = shiftMove(direction, index, timeOption, dayShift);
      return {
        index: shiftMoveResult.index,
        dayShift: shiftMoveResult.dayShift,
      };
    } else {
      throw new TypeError('Unknown range type');
    }
  }
  throw new Error('Invalid range');
}

export function shiftMove(direction, index, timeOption, dayShift) {
  if (rangeIsValid(timeOption[index])) {
    if (dayShift % 1 !== 0 || isNaN(dayShift) || dayShift.length === 0) {
      throw new Error('Invalid dayShift');
    }
    if (direction !== -1 && direction !== 0 && direction !== 1) {
      throw new Error('Invalid direction');
    }
    if (direction === -1 && index === 0) {
      index = timeOption.length - 1;

      if (timeOption[index].newDay || timeOption.length === 1) {
        dayShift -= 1;
      }
      return {
        index: index,
        dayShift: dayShift,
      };
    } else if (direction === 1 && index === timeOption.length - 1) {
      index = 0;

      if (timeOption[index].newDay || timeOption.length === 1) {
        dayShift += 1;
      }
      return {
        index: index,
        dayShift: dayShift,
      };
    } else {
      // If CURRENT shift starts a new day
      if (timeOption[index].newDay && direction === 1) {
        dayShift += 1;
      }
      index += direction;
      // If NEXT shift starts a new day
      if (timeOption[index].newDay && direction === -1) {
        dayShift -= 1;
      }
      return {
        index: index,
        dayShift: dayShift,
      };
    }
  }
  throw new Error('Invalid range');
}

// Sets range absoluteFrom and absoluteTo based on dayshift input
export function shift(range, dayShift) {
  if (rangeIsValid(range)) {
    if (dayShift % 1 !== 0 || isNaN(dayShift) || dayShift.length === 0) {
      throw new Error('Invalid dayShift');
    }
    const now = new Date();
    let today, tomorrow;
    now.setDate(now.getDate() + dayShift);

    today = getDateString(now);

    if (range.newDay) {
      now.setDate(now.getDate() + 1);
      tomorrow = getDateString(now);
      range.absoluteFrom = today + ' ' + range.from + ':00';
      range.absoluteTo = tomorrow + ' ' + range.to + ':00';
      return range;
    } else {
      range.absoluteFrom = today + ' ' + range.from + ':00';
      range.absoluteTo = today + ' ' + range.to + ':00';
      return range;
    }
  }
  throw new Error('Invalid range');
}

// Sets range absoluteFrom and absoluteTo to its last posible state till now
/*
function lastShift (range) {
    const now = new Date();
    let today, yesterday, dayShift = 0;

    range.to > getTimeString(now) ? dayShift = -1 : dayShift = 0;
    //console.log(range.to,' < ',getTimeString(now),' result:', dayShift);

    now.setDate(now.getDate() + dayShift);
    today = getDateString(now);

    if (range.newDay) {
        //console.log('new day');
        now.setDate(now.getDate() - 1);
        yesterday = getDateString(now);
        range.absoluteFrom = yesterday + ' ' + range.from + ':00';
        range.absoluteTo = today + ' ' + range.to + ':00';
        //console.log(range);
        return range;
    } else {
        //console.log('not new day');
        range.absoluteFrom = today + ' ' + range.from + ':00';
        range.absoluteTo = today + ' ' + range.to + ':00';
        //console.log(range);
        return range;
    }
}*/

// Sets range absoluteFrom and absoluteTo based on TimeRaw.from from timepicker itself
export function shiftByDay(range, editTimeRaw) {
  if (rangeIsValid(range)) {
    //console.log(editTimeRaw);
    const from = moment(editTimeRaw.from).format('YYYY-MM-DD');
    const diff = moment().diff(from, 'days');
    if (range.newDay) {
      editTimeRaw.from = moment(editTimeRaw.from, 'YYYY-MM-DD').add(1, 'days');
    }
    const to = moment(editTimeRaw.from).format('YYYY-MM-DD');

    range.absoluteFrom = from + ' ' + range.from + ':00';
    range.absoluteTo = to + ' ' + range.to + ':00';
    return {
      range: range,
      dayShift: -diff,
    };
  }
  throw new Error('Invalid range');
}

export function getDateString(date) {
  if (!(date instanceof Date)) {
    throw new Error('Input is not instance of Date');
  }
  const now = date;
  const year = now.getFullYear();
  let month = (now.getMonth() + 1).toString();
  let day = now.getDate().toString();
  if (month.toString().length === 1) {
    month = '0' + month;
  }
  if (day.toString().length === 1) {
    day = '0' + day;
  }

  const dateTimeString = year + '-' + month + '-' + day;
  return dateTimeString;
}

export function rangeIsValid(range) {
  // from and to validation
  if (range === undefined || range === null) {
    return false;
  }
  const re = /^([[0-1][0-9]|2[0-4]):[0-5][0-9]$/;
  if (!re.test(range.to) || !re.test(range.from)) {
    return false;
  }
  // newDay validation
  if (typeof range.newDay !== 'boolean') {
    return false;
  } else if (range.newDay === undefined || range.newDay === null) {
    return false;
  }
  // name validation
  if (!range.name || 0 === range.name.length) {
    return false;
  }
  return true;
}
