import { logInfo } from '@grafana/runtime';

import { logOptions } from './logOptions';

jest.mock('@grafana/runtime', () => ({
  logInfo: jest.fn(),
}));

const RECOMMENDED_AMOUNT = 10;

describe('logOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not log anything if amount is less than or equal to recommendedAmount', () => {
    console.warn = jest.fn();

    logOptions(5, RECOMMENDED_AMOUNT, 'test-id', 'test-aria');

    expect(console.warn).not.toHaveBeenCalled();
    expect(logInfo).not.toHaveBeenCalled();
  });

  it('should log a warning and call logInfo if amount exceeds recommendedAmount', () => {
    console.warn = jest.fn();

    logOptions(15, RECOMMENDED_AMOUNT, 'test-id', 'test-aria');

    expect(console.warn).toHaveBeenCalledWith('[Combobox] Items exceed the recommended amount 10.');
    expect(logInfo).toHaveBeenCalledWith('[Combobox] Items exceed the recommended amount 10.', {
      itemsCount: '15',
      recommendedAmount: '10',
      'aria-labelledby': 'test-aria',
      id: 'test-id',
    });
  });

  it('should log a warning if logInfo throws an error', () => {
    console.warn = jest.fn();
    (logInfo as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });

    logOptions(15, RECOMMENDED_AMOUNT, 'test-id', 'test-aria');

    expect(console.warn).toHaveBeenCalledWith('[Combobox] Items exceed the recommended amount 10.');
    expect(console.warn).toHaveBeenCalledWith('Failed to log faro event!');
  });
});
