import { currency } from './symbolFormatters';

describe('Currency', () => {
  it('should format as usd', () => {
    expect(currency('$')(1532.82, 1, -1)).toEqual('$1.53K');
  });
});
