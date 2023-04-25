import { formatServiceId, stripServiceId } from './FailedChecksTab.utils';

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('FailedChecksTab::utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('stripServiceId', () => {
    expect(stripServiceId('')).toBe('');
    expect(stripServiceId('service_id/service1')).toBe('');
    expect(stripServiceId('/service_idservice1')).toBe('');
    expect(stripServiceId('/service_id/')).toBe('');
    expect(stripServiceId('/service_id/service1')).toBe('service1');
  });

  test('formatServiceId', () => {
    expect(formatServiceId('')).toBe('/service_id/');
    expect(formatServiceId('service1')).toBe('/service_id/service1');
  });
});
