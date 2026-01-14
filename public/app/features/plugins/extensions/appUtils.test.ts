import { getAppPluginConfigs } from './appUtils';

describe('getAppPluginConfigs', () => {
  it('should return an empty array when no arguments are supplied', () => {
    expect(getAppPluginConfigs()).toEqual([]);
  });
});
