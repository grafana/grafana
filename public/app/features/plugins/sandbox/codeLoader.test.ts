import { PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getPluginCode } from './codeLoader';

jest.mock('../loader/pluginInfoCache', () => ({
  ...jest.requireActual('../loader/pluginInfoCache'),
  resolvePluginUrlWithCache: jest.fn((url: string) => `http://localhost:3000${url}?_cache=abc`),
}));

const CDN_BASE_URL = 'https://cdn.example.com/plugins';
const SOURCE = 'console.log("hello");';

describe('getPluginCode SRI verification', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalFetch = global.fetch;
  const originalCdnBaseUrl = config.pluginsCDNBaseURL;
  let digest: jest.Mock;

  beforeEach(() => {
    digest = jest.fn().mockResolvedValue(new Uint8Array(32).buffer);
    Object.defineProperty(globalThis, 'crypto', { value: { subtle: { digest } }, configurable: true });
    global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(SOURCE) });
    config.pluginsCDNBaseURL = CDN_BASE_URL;
  });

  afterEach(() => {
    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', originalCrypto);
    } else {
      Reflect.deleteProperty(globalThis, 'crypto');
    }
    global.fetch = originalFetch;
    config.pluginsCDNBaseURL = originalCdnBaseUrl;
  });

  describe.each([
    {
      name: 'local',
      module: 'public/plugins/test-plugin/module.js',
      fetchedUrl: 'http://localhost:3000/public/plugins/test-plugin/module.js?_cache=abc',
    },
    {
      name: 'CDN',
      module: `${CDN_BASE_URL}/test-plugin/1.0.0/public/plugins/test-plugin/module.js`,
      fetchedUrl: `${CDN_BASE_URL}/test-plugin/1.0.0/public/plugins/test-plugin/module.js`,
    },
  ])('$name plugin', ({ module, fetchedUrl }) => {
    const meta = { id: 'test-plugin', type: PluginType.panel, module };

    it('computes a SHA-256 digest of the fetched source when a module hash is provided', async () => {
      const code = await getPluginCode({ ...meta, moduleHash: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });

      expect(code).toBe(SOURCE);
      expect(global.fetch).toHaveBeenCalledWith(fetchedUrl);
      expect(digest.mock.calls.map(([algorithm, data]) => ({ algorithm, data: Array.from(data) }))).toEqual([
        {
          algorithm: 'SHA-256',
          data: [99, 111, 110, 115, 111, 108, 101, 46, 108, 111, 103, 40, 34, 104, 101, 108, 108, 111, 34, 41, 59],
        },
      ]);
    });

    it('does not compute a digest when there is no module hash', async () => {
      const code = await getPluginCode(meta);

      expect(code).toBe(SOURCE);
      expect(digest).not.toHaveBeenCalled();
    });

    it('does not compute a digest when the module hash is empty', async () => {
      const code = await getPluginCode({ ...meta, moduleHash: '' });

      expect(code).toBe(SOURCE);
      expect(digest).not.toHaveBeenCalled();
    });
  });
});
