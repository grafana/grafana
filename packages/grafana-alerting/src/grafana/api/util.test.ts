import { config } from '@grafana/runtime';

import { base64UrlEncode, getAPIBaseURL, getAPINamespace, getAPIReducerPath } from './util';

describe('API utilities', () => {
  const originalAppSubUrl = config.appSubUrl;
  const originalNamespace = config.namespace;

  afterEach(() => {
    // Restore original config after each test
    config.appSubUrl = originalAppSubUrl;
    config.namespace = originalNamespace;
  });

  describe('getAPIBaseURL', () => {
    const group = 'notifications.alerting.grafana.app';
    const version = 'v0alpha1';

    it('should generate correct API base URL without subpath', () => {
      config.appSubUrl = '';
      config.namespace = 'default';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default');
    });

    it('should generate correct API base URL with subpath', () => {
      config.appSubUrl = '/grafana';
      config.namespace = 'default';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/grafana/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default');
    });

    it('should handle different namespace', () => {
      config.appSubUrl = '/grafana';
      config.namespace = 'custom-namespace';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/grafana/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/custom-namespace');
    });
  });

  describe('getAPINamespace', () => {
    it('should return configured namespace', () => {
      config.namespace = 'test-namespace';

      const result = getAPINamespace();

      expect(result).toBe('test-namespace');
    });
  });

  describe('getAPIReducerPath', () => {
    it('should generate correct reducer path', () => {
      const group = 'notifications.alerting.grafana.app';
      const version = 'v0alpha1';

      const result = getAPIReducerPath(group, version);

      expect(result).toBe('notifications.alerting.grafana.app/v0alpha1');
    });
  });

  describe('base64UrlEncode', () => {
    it('should encode simple ASCII strings', () => {
      expect(base64UrlEncode('hello')).toBe('aGVsbG8');
    });

    it('should encode strings with special characters', () => {
      expect(base64UrlEncode('hello world!')).toBe('aGVsbG8gd29ybGQh');
    });

    it('should handle emoji characters correctly', () => {
      // Single emoji
      expect(base64UrlEncode('⛳')).toBe('4puz');
      // Multi-byte emoji
      expect(base64UrlEncode('🧀')).toBe('8J-ngA');
      // Emoji with variant selector
      expect(base64UrlEncode('❤️')).toBe('4p2k77iP');
    });

    it('should handle mixed ASCII and Unicode characters', () => {
      const input = 'hello⛳❤️🧀';
      const encoded = base64UrlEncode(input);
      expect(encoded).toBe('aGVsbG_im7PinaTvuI_wn6eA');
    });

    it('should convert to base64url format (no padding)', () => {
      // Standard base64 would have padding with '='
      const result = base64UrlEncode('test');
      expect(result).not.toContain('=');
    });

    it('should replace + with - and / with _', () => {
      // String that produces both + and / in standard base64
      const input = 'a??b'; // produces 'YT8/Yg==' in base64, which has /
      const input2 = 'a?>b'; // produces 'YT8+Yg==' in base64, which has +
      const encoded = base64UrlEncode(input);
      const encoded2 = base64UrlEncode(input2);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded2).not.toContain('+');
      expect(encoded2).not.toContain('/');
      expect(encoded).toContain('_'); // Should have _ instead of /
      expect(encoded2).toContain('-'); // Should have - instead of +
    });

    it('should handle empty strings', () => {
      expect(base64UrlEncode('')).toBe('');
    });

    it('should handle contact point names with special characters', () => {
      expect(base64UrlEncode('my-contact-point')).toBe('bXktY29udGFjdC1wb2ludA');
      expect(base64UrlEncode('Contact Point 🔔')).toBe('Q29udGFjdCBQb2ludCDwn5SU');
    });

    it('should throw error for malformed UTF-16 strings with lone surrogates', () => {
      // String with lone high surrogate
      const malformedString = 'hello\uDE75';
      expect(() => base64UrlEncode(malformedString)).toThrow(
        'Cannot encode malformed UTF-16 string with lone surrogates'
      );
    });

    it('should handle well-formed strings with proper surrogate pairs', () => {
      // Proper surrogate pair for emoji (U+1F9C0)
      const wellFormedString = 'hello\uD83E\uDDC0';
      expect(() => base64UrlEncode(wellFormedString)).not.toThrow();
    });
  });
});
