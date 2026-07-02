import { buildRoutingParams } from './useImport';

describe('buildRoutingParams', () => {
  it('should return notificationSettings with policy when a routing tree is selected', () => {
    const result = buildRoutingParams('my-policy');

    expect(result).toEqual({
      notificationSettings: JSON.stringify({ policy: 'my-policy' }),
    });
  });

  it('should return notificationSettings=undefined when no routing tree is selected', () => {
    const result = buildRoutingParams(undefined);

    expect(result).toEqual({ notificationSettings: undefined });
  });

  it('should return notificationSettings=undefined for empty string routing tree', () => {
    const result = buildRoutingParams('');

    expect(result).toEqual({ notificationSettings: undefined });
  });
});
