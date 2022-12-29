import { getMockPlugin, getMockPlugins } from '@grafana/data/test/__mocks__/pluginMocks';

import { nameExits, findNewName } from './utils';

describe('Datasources / Utils', () => {
  describe('nameExists()', () => {
    const plugins = getMockPlugins(5);

    it('should return TRUE if an existing plugin already has the same name', () => {
      expect(nameExits(plugins, plugins[1].name)).toEqual(true);
    });

    it('should return FALSE if no plugin has the same name yet', () => {
      expect(nameExits(plugins, 'unknown-plugin'));
    });
  });

  describe('findNewName()', () => {
    it('should return with a new name in case an existing plugin already has the same name', () => {
      const plugins = getMockPlugins(5);
      const name = 'pretty cool plugin-1';

      expect(findNewName(plugins, name)).toEqual('pretty cool plugin-6');
    });

    it('should handle names without suffixes when name already exists', () => {
      const name = 'prometheus';
      const plugin = getMockPlugin({ name });

      expect(findNewName([plugin], name)).toEqual('prometheus-1');
    });

    it('should handle names that end with a "-" when name does not exist yet', () => {
      const plugin = getMockPlugin();
      const plugins = [plugin];
      const name = 'pretty cool plugin-';

      expect(findNewName(plugins, name)).toEqual('pretty cool plugin-');
    });
  });
});
