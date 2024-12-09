import { config } from '@grafana/runtime';

import { createAbsoluteUrl, createRelativeUrl } from './url';

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
