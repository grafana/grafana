import { createDateTimeFormatter } from './formatter';

describe('DateTimeFormatter', () => {
  describe('when no time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => '');

    // by default jest is running with local set to utc.
    // see setup-jest.ts for more information.
    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 12:36:15');
    });
  });

  describe('when UTC time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'utc');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 12:36:15');
    });
  });

  describe('when Europe/Stockholm time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'Europe/Stockholm');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 14:36:15');
    });
  });

  describe('when Australia/Perth time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'Australia/Perth');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 20:36:15');
    });
  });

  describe('when Asia/Yakutsk time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'Asia/Yakutsk');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 21:36:15');
    });
  });

  describe('when America/Panama time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'America/Panama');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 07:36:15');
    });
  });

  describe('when America/Los_Angeles time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'America/Los_Angeles');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 05:36:15');
    });
  });

  describe('when Africa/Djibouti time zone have been set', () => {
    const formatter = createDateTimeFormatter(() => 'Africa/Djibouti');

    it('should format with default formatting in correct time zone', () => {
      expect(formatter.format(1587126975779)).toBe('2020-04-17 15:36:15');
    });
  });
});
