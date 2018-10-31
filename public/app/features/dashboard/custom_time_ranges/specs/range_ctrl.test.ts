import {
  customTimeRangePicked,
  customMove,
  shiftMove,
  shift,
  shiftByDay,
  getDateString,
  rangeIsValid,
} from '../range_ctrl';
import moment from 'moment';

describe('range_ctrl', () => {
  describe('getDateString function', () => {
    it('should convert Date to string in format YYYY-MM-DD', () => {
      function stringError() {
        getDateString('string');
      }
      function objectError() {
        getDateString({});
      }
      function arrayError() {
        getDateString([]);
      }
      function numberError() {
        getDateString(2);
      }
      expect(getDateString(new Date('July 21, 1983 01:15:00'))).toBe('1983-07-21');
      expect(stringError).toThrowError('Input is not instance of Date');
      expect(objectError).toThrowError('Input is not instance of Date');
      expect(arrayError).toThrowError('Input is not instance of Date');
      expect(numberError).toThrowError('Input is not instance of Date');
    });
  });

  // customTimeRangePicked(mode,range,dayShift,editTimeRaw)
  describe('customTimeRangePicked function', () => {
    // Mock
    function modeError() {
      const range = { type: 'shift' };
      customTimeRangePicked('incorrect', range, '', '');
    }
    function ragneTypeError() {
      const range = { type: 'incorrect' };
      customTimeRangePicked('shift', range, '', '');
    }
    it('should return error for incorrect range type', () => {
      expect(ragneTypeError).toThrowError('Unknown range type');
    });
    it('should return error for incorrect mode', () => {
      expect(modeError).toThrowError('Unknown mode');
    });
  });

  // customMove (direction,index,timeOption,dayShift)
  describe('customMove function', () => {
    function typeError() {
      const option = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: false };
      customMove(1, 0, [option], 1);
    }
    function rangeError() {
      customMove(1, 0, '', 1);
    }
    // Mock
    it('should call correct function based on curent timeOption type (timeOption[index])', () => {
      const option = { type: 'shift', name: 'name', from: '08:00', to: '15:30', newDay: false };
      expect(customMove(1, 0, [option], 1)).toEqual({ dayShift: 2, index: 0 });
    });
    it('should return an error for incorrect timeOption.type type', () => {
      expect(typeError).toThrowError('Unknown range type');
    });
    it('should return an error for incorrect timeOption type', () => {
      expect(rangeError).toThrowError('Invalid range');
    });
  });

  // shiftMove (direction,index,timeOption,dayShift)
  describe('shiftMove function', () => {
    function directionError() {
      const option = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: false },
        newDayOption = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: true };
      const timeOptions = [option, newDayOption, option];
      shiftMove('a', 1, timeOptions, 1);
    }
    function timeOptionError() {
      shiftMove(1, 1, 'timeOptions', 1);
    }
    function dayShiftError() {
      const option = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: false },
        newDayOption = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: true };
      const timeOptions = [option, newDayOption, option];
      shiftMove(1, 1, timeOptions, 'dayShift');
    }
    it('should return index and dayShift for timeOption to be shown based on direction and curent timeOption', () => {
      const option = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: false },
        newDayOption = { type: 'incorrect', name: 'name', from: '08:00', to: '15:30', newDay: true };

      const timeOptions = [option, newDayOption, option];
      const result = shiftMove(1, 1, timeOptions, 1);

      expect(result.index).toBe(2);
      expect(result.dayShift).toBe(2);
    });
    it('should return error for direction input has incorrect format', () => {
      expect(directionError).toThrowError('Invalid direction');
    });
    it('should return error for timeOption input has incorrect format', () => {
      expect(timeOptionError).toThrowError('Invalid range');
    });
    it('should return error for dayShift input has incorrect format', () => {
      expect(dayShiftError).toThrowError('Invalid dayShift');
    });
  });

  // shift (range,dayShift)
  describe('shift function', () => {
    function rangeError() {
      shift('', 1);
    }
    function dayShiftError() {
      const range = { newDay: false, from: '08:00', to: '15:30', name: 'name' };
      shift(range, '');
    }
    it('should change dates in range.absoluteFrom and range.absoluteTo based on dayShift input', () => {
      const range = { newDay: false, from: '08:00', to: '15:30', name: 'name' };
      const from = moment().format('YYYY-MM-DD') + ' 08:00:00';
      const to = moment().format('YYYY-MM-DD') + ' 15:30:00';

      expect(shift(range, 0)).toEqual({
        absoluteFrom: from,
        absoluteTo: to,
        from: '08:00',
        newDay: false,
        to: '15:30',
        name: 'name',
      });
    });
    it('should return error for range input has incorrect format', () => {
      expect(rangeError).toThrowError('Invalid range');
    });
    it('should return error for dayShift input has incorrect format', () => {
      expect(dayShiftError).toThrowError('Invalid dayShift');
    });
  });

  // shiftByDay (range,editTimeRaw)
  describe('shiftByDay function', () => {
    function rangeError() {
      const editTimeRaw = { from: moment('2018-09-01', 'YYYY-MM-DD') };
      expect(shiftByDay('range', editTimeRaw)).toEqual({});
    }
    it('should change dates in range.absoluteFrom and range.absoluteTo based on editTimeRaw.from input', () => {
      const editTimeRaw = { from: moment('2018-09-01', 'YYYY-MM-DD') };
      const range = { newDay: false, from: '08:00', to: '15:30', name: 'name' };
      //const now = moment();
      const diff = -moment().diff('2018-09-01', 'days');
      expect(shiftByDay(range, editTimeRaw)).toEqual({
        dayShift: diff,
        range: {
          absoluteFrom: '2018-09-01 08:00:00',
          absoluteTo: '2018-09-01 15:30:00',
          from: '08:00',
          newDay: false,
          to: '15:30',
          name: 'name',
        },
      });
    });
    it('should return error for range input has incorrect format', () => {
      expect(rangeError).toThrowError('Invalid range');
    });
  });

  describe('rangeIsValid function', () => {
    it('should validate range object and return true for valid range', () => {
      const range = {
        name: 'name',
        newDay: true,
        from: '05:55',
        to: '23:03',
      };
      expect(rangeIsValid(range)).toEqual(true);
    });
    it('should validate range object and return false for invalid range.name', () => {
      const range = {
        name: '',
        newDay: false,
        from: '08:00',
        to: '15:30',
      };
      expect(rangeIsValid(range)).toEqual(false);
    });
    it('should validate range object and return false for invalid range.from', () => {
      const range = {
        name: 'name',
        newDay: false,
        from: 'time from',
        to: '15:30',
      };
      expect(rangeIsValid(range)).toEqual(false);
    });
    it('should validate range object and return false for invalid range.to', () => {
      const range = {
        name: 'name',
        newDay: false,
        from: '08:00',
        to: {},
      };
      expect(rangeIsValid(range)).toEqual(false);
    });
    it('should validate range object and return false for invalid range', () => {
      expect(rangeIsValid('range')).toEqual(false);
    });
  });
});
