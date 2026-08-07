import raqbMoment from './raqbMomentCompat';

// exercises the moment API surface @react-awesome-query-builder relies on, so regressions in the
// luxon-backed compat layer that would break the query builder's date handling surface here
describe('raqbMomentCompat', () => {
  it('parses and formats with moment-style format tokens', () => {
    expect(raqbMoment('2024-05-06 10:30:00', 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2024-05-06 10:30:00'
    );
    expect(raqbMoment('2024-05-06', 'YYYY-MM-DD').format('YYYY-MM-DD')).toBe('2024-05-06');
    expect(raqbMoment('10:30:00', 'HH:mm:ss').format('HH:mm:ss')).toBe('10:30:00');
  });

  it('reports validity of parsed values', () => {
    expect(raqbMoment('2024-05-06', 'YYYY-MM-DD').isValid()).toBe(true);
    expect(raqbMoment('not a date', 'YYYY-MM-DD').isValid()).toBe(false);
  });

  it('parses ISO 8601 input via the ISO_8601 format constant', () => {
    expect(raqbMoment('2024-05-06T10:30:00Z', raqbMoment.ISO_8601).isValid()).toBe(true);
  });

  it('supports utc() with array input and 0-based month/1-based day getters (jsonLogic "today" pattern)', () => {
    // mirrors RAQB's `today` helper: moment.utc([start.year(), start.month(), start.date()])
    const start = raqbMoment().startOf('day');
    expect(raqbMoment.utc([start.year(), start.month(), start.date()]).isValid()).toBe(true);

    expect(raqbMoment.utc([2024, 4, 6]).toDate().toISOString()).toBe('2024-05-06T00:00:00.000Z');
  });

  it('supports add() and startOf() (jsonLogic date_add/datetime_truncate patterns)', () => {
    const d = raqbMoment.utc('2024-05-06 10:30:00', 'YYYY-MM-DD HH:mm:ss');
    expect(d.add(1, 'day').format('YYYY-MM-DD HH:mm:ss')).toBe('2024-05-07 10:30:00');
    expect(d.startOf('day').format('YYYY-MM-DD HH:mm:ss')).toBe('2024-05-07 00:00:00');
  });

  it('supports isSame() comparisons (jsonLogic date==/datetime== patterns)', () => {
    expect(raqbMoment('2024-05-06').startOf('day').isSame(raqbMoment('2024-05-06').startOf('day'))).toBe(true);
    expect(raqbMoment('2024-05-06').startOf('day').isSame(raqbMoment('2024-05-07').startOf('day'))).toBe(false);
  });
});
