import { findNewName, nameExits } from './actions';
import { getMockPlugin, getMockPlugins } from '../../plugins/__mocks__/pluginMocks';

describe('Name exists', () => {
  const plugins = getMockPlugins(5);

  it('should be true', () => {
    const name = 'pretty cool plugin-1';

    expect(nameExits(plugins, name)).toEqual(true);
  });

  it('should be false', () => {
    const name = 'pretty cool plugin-6';

    expect(nameExits(plugins, name));
  });
});

describe('Find new name', () => {
  it('should create a new name', () => {
    const plugins = getMockPlugins(5);
    const name = 'pretty cool plugin-1';

    expect(findNewName(plugins, name)).toEqual('pretty cool plugin-6');
  });

  it('should create new name without suffix', () => {
    const plugin = getMockPlugin();
    plugin.name = 'prometheus';
    const plugins = [plugin];
    const name = 'prometheus';

    expect(findNewName(plugins, name)).toEqual('prometheus-1');
  });

  it('should handle names that end with -', () => {
    const plugin = getMockPlugin();
    const plugins = [plugin];
    const name = 'pretty cool plugin-';

    expect(findNewName(plugins, name)).toEqual('pretty cool plugin-');
  });
});
