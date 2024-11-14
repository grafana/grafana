import { logOptions } from './logOptions';

const RECOMMENDED_AMOUNT = 10;

describe('logOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not log anything if amount is less than or equal to recommendedAmount', () => {
    console.warn = jest.fn();

    logOptions(5, RECOMMENDED_AMOUNT, 'test-id', 'test-aria');

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should log a warning if amount exceeds recommendedAmount', () => {
    console.warn = jest.fn();

    logOptions(15, RECOMMENDED_AMOUNT, 'test-id', 'test-aria');

    expect(console.warn).toHaveBeenCalledWith('[Combobox] Items exceed the recommended amount 10.', {
      itemsCount: '15',
      recommendedAmount: '10',
      'aria-labelledby': 'test-aria',
      id: 'test-id',
    });
  });
});
