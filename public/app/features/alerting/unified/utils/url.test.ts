import { config } from '@grafana/runtime';

import { createAbsoluteUrl, createRelativeUrl, isRelativeUrl } from './url';

config.appSubUrl = '/base';
config.appUrl = 'https://example.com';

describe('createRelativeUrl', () => {
  it('should create a relative URL with no query parameters', () => {
    expect(createRelativeUrl('/test')).toBe('/base/test');
  });

  it('should create a relative URL with string query parameters', () => {
    expect(createRelativeUrl('/test', 'param1=value1&param2=value2')).toBe('/base/test?param1=value1&param2=value2');
  });

  it('should create a relative URL with object query parameters', () => {
    expect(createRelativeUrl('/test', { param1: 'value1', param2: 'value2' })).toBe(
      '/base/test?param1=value1&param2=value2'
    );
  });

  it('should create a relative URL with array query parameters', () => {
    expect(
      createRelativeUrl('/test', [
        ['param1', 'value1'],
        ['param2', 'value2'],
      ])
    ).toBe('/base/test?param1=value1&param2=value2');
  });
});

describe('isRelativeUrl', () => {
  it('should return true for paths starting with /', () => {
    expect(isRelativeUrl('/explore')).toBe(true);
    expect(isRelativeUrl('/alerting/list')).toBe(true);
    expect(isRelativeUrl('/')).toBe(true);
  });

  it('should return false for protocol-relative URLs', () => {
    expect(isRelativeUrl('//evil.com/path')).toBe(false);
    expect(isRelativeUrl('//example.com')).toBe(false);
  });

  it('should return false for absolute URLs', () => {
    expect(isRelativeUrl('https://example.com/path')).toBe(false);
    expect(isRelativeUrl('http://example.com')).toBe(false);
  });

  it('should return false for other strings', () => {
    expect(isRelativeUrl('')).toBe(false);
    expect(isRelativeUrl('relative/path')).toBe(false);
  });
});

describe('createAbsoluteUrl', () => {
  it('should create an absolute URL with no query parameters', () => {
    expect(createAbsoluteUrl('/test')).toBe('https://example.com/base/test');
  });

  it('should create an absolute URL with string query parameters', () => {
    expect(createAbsoluteUrl('/test', 'param1=value1&param2=value2')).toBe(
      'https://example.com/base/test?param1=value1&param2=value2'
    );
  });

  it('should create an absolute URL with object query parameters', () => {
    expect(createAbsoluteUrl('/test', { param1: 'value1', param2: 'value2' })).toBe(
      'https://example.com/base/test?param1=value1&param2=value2'
    );
  });

  it('should create an absolute URL with array query parameters', () => {
    expect(
      createAbsoluteUrl('/test', [
        ['param1', 'value1'],
        ['param2', 'value2'],
      ])
    ).toBe('https://example.com/base/test?param1=value1&param2=value2');
  });

  it('should fallback to relative URL if base URL is invalid', () => {
    const originalAppUrl = config.appUrl;
    config.appUrl = 'invalid-url';
    expect(createAbsoluteUrl('/test')).toBe('/base/test');
    config.appUrl = originalAppUrl;
  });
});
