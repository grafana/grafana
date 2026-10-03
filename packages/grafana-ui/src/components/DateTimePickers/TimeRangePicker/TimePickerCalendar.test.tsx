import { render, screen } from '@testing-library/react';

import { dateTime, getLocale, setLocale } from '@grafana/data';

import { Body, inputToValue } from './CalendarBody';

describe('Body', () => {
  const originalLocale = getLocale();

  afterEach(() => {
    setLocale(originalLocale);
  });

  const renderBody = () =>
    render(
      <Body
        isOpen={true}
        isFullscreen={true}
        from={dateTime('2020-04-16T10:00:00.000Z')}
        to={dateTime('2020-04-16T11:00:00.000Z')}
        weekStart="monday"
        onChange={jest.fn()}
        onClose={jest.fn()}
        onApply={jest.fn()}
      />
    );

  // react-calendar renders the weekday row as plain divs, so there is no role to query them by
  const getWeekdayNames = () =>
    Array.from(document.querySelectorAll('.react-calendar__month-view__weekdays abbr')).map((el) => el.textContent);

  it('renders month and weekday names in the locale set for the app', () => {
    setLocale('cs-CZ');

    renderBody();

    expect(screen.getByRole('button', { name: 'duben 2020' })).toBeInTheDocument();
    expect(getWeekdayNames()).toEqual(['po', 'út', 'st', 'čt', 'pá', 'so', 'ne']);
  });

  it('renders month and weekday names in English when the app locale is English', () => {
    setLocale('en-US');

    renderBody();

    expect(screen.getByRole('button', { name: 'April 2020' })).toBeInTheDocument();
    expect(getWeekdayNames()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

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
