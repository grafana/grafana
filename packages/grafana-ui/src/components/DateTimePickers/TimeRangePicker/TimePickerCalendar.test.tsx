import { dateTime } from '@grafana/data';

import { inputToValue } from './CalendarBody';

describe('inputToValue', () => {
  describe('when called with valid dates', () => {
    describe('and from is after to', () => {
      it('then to should be first in the result', () => {
        const from = dateTime('2020-04-16T11:00:00.000Z');
        const to = dateTime('2020-04-16T10:00:00.000Z');

        const result = inputToValue(from, to);

        expect(result).toEqual([new Date('2020-04-16T10:00:00.000Z'), new Date('2020-04-16T11:00:00.000Z')]);
      });
    });

    describe('and from is before to', () => {
      it('then to should be second in the result', () => {
        const from = dateTime('2020-04-16T10:00:00.000Z');
        const to = dateTime('2020-04-16T11:00:00.000Z');

        const result = inputToValue(from, to);

        expect(result).toEqual([new Date('2020-04-16T10:00:00.000Z'), new Date('2020-04-16T11:00:00.000Z')]);
      });
    });
  });

  describe('when called with an invalid from datetime', () => {
    it('then from should replaced with specified default', () => {
      const from = dateTime('2020-04-32T10:00:00.000Z'); // invalid date
      const to = dateTime('2020-04-16T10:00:00.000Z');
      const invalidDateDefault = new Date('2020-04-16T11:00:00.000Z');

      const result = inputToValue(from, to, invalidDateDefault);

      expect(result).toEqual([new Date('2020-04-16T10:00:00.000Z'), new Date('2020-04-16T11:00:00.000Z')]);
    });
  });

  describe('when called with an invalid to datetime', () => {
    it('then to should replaced with specified default', () => {
      const from = dateTime('2020-04-16T10:00:00.000Z');
      const to = dateTime('2020-04-32T10:00:00.000Z'); // invalid date
      const invalidDateDefault = new Date('2020-04-16T11:00:00.000Z');

      const result = inputToValue(from, to, invalidDateDefault);

      expect(result).toEqual([new Date('2020-04-16T10:00:00.000Z'), new Date('2020-04-16T11:00:00.000Z')]);
    });
  });
});
