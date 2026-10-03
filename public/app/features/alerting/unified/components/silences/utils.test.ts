import { getDefaultSilenceFormValues } from './utils';

describe('getDefaultSilenceFormValues', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('back-dates startsAt by 60 seconds to tolerate the browser clock running ahead of the Alertmanager server', () => {
    const { startsAt } = getDefaultSilenceFormValues();

    expect(startsAt).toBe('2024-01-01T11:59:00.000Z');
  });

  it('keeps the default silence duration at 2 hours from the back-dated startsAt', () => {
    const { startsAt, endsAt } = getDefaultSilenceFormValues();

    expect(startsAt).toBe('2024-01-01T11:59:00.000Z');
    expect(endsAt).toBe('2024-01-01T13:59:00.000Z');
  });
});
