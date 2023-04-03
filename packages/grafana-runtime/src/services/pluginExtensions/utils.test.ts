import { PluginExtension, PluginExtensionTypes } from '@grafana/data';

import { isPluginExtensionLink } from './utils';

describe('Plugin Extensions / Utils', () => {
  describe('isPluginExtensionLink()', () => {
    test('should return TRUE if the object is a link extension', () => {
      expect(
        isPluginExtensionLink({
          id: 'id',
          pluginId: 'plugin-id',
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtension)
      ).toBe(true);
    });
    test('should return FALSE if the object is NOT a link extension', () => {
      expect(
        isPluginExtensionLink({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
        } as PluginExtension)
      ).toBe(false);

      expect(
        // @ts-ignore (Right now we only have a single type of extension)
        isPluginExtensionLink({
          type: 'unknown',
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtension)
      ).toBe(false);
    });
  });
});
