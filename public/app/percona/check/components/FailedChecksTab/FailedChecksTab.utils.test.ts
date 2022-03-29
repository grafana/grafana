import { stripServiceId, formatServiceId } from './FailedChecksTab.utils';

const originalPlatformCore = jest.requireActual('@percona/platform-core');

jest.mock('@percona/platform-core', () => ({
  ...originalPlatformCore,
  logger: {
    error: jest.fn(),
  },
}));

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
