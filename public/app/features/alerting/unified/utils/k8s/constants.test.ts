import { ROOT_ROUTE_NAME } from './constants';

describe('ROOT_ROUTE_NAME', () => {
  it('is the user-defined send name', () => {
    expect(ROOT_ROUTE_NAME).toBe('user-defined');
  });
});
