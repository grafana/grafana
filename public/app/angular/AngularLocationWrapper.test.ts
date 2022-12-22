import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';

import { AngularLocationWrapper } from './AngularLocationWrapper';

// The methods in this file are deprecated
// Stub the deprecation warning here to prevent polluting the test output
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  deprecationWarning: () => {},
}));

describe('AngularLocationWrapper', () => {
  const { location } = window;

  beforeEach(() => {
    setLocationService(new HistoryWrapper());
  });

  beforeAll(() => {
    // @ts-ignore
    delete window.location;

    window.location = {
      ...location,
      hash: '#hash',
      host: 'localhost:3000',
      hostname: 'localhost',
      href: 'http://www.domain.com:9877/path/b?search=a&b=c&d#hash',
      origin: 'http://www.domain.com:9877',
      pathname: '/path/b',
      port: '9877',
      protocol: 'http:',
      search: '?search=a&b=c&d',
    };
  });

  afterAll(() => {
    window.location = location;
  });

  const wrapper = new AngularLocationWrapper();
  it('should provide common getters', () => {
    locationService.push('/path/b?search=a&b=c&d#hash');

    expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?search=a&b=c&d#hash');
    expect(wrapper.protocol()).toBe('http');
    expect(wrapper.host()).toBe('www.domain.com');
    expect(wrapper.port()).toBe(9877);
    expect(wrapper.path()).toBe('/path/b');
    expect(wrapper.search()).toEqual({ search: 'a', b: 'c', d: true });
    expect(wrapper.hash()).toBe('hash');
    expect(wrapper.url()).toBe('/path/b?search=a&b=c&d#hash');
  });

  describe('path', () => {
    it('should change path', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.path('/new/path');

      expect(wrapper.path()).toBe('/new/path');
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/new/path?search=a&b=c&d#hash');
    });

    it('should not break on numeric values', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.path(1);
      expect(wrapper.path()).toBe('/1');
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/1?search=a&b=c&d#hash');
    });

    it('should allow using 0 as path', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.path(0);
      expect(wrapper.path()).toBe('/0');
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/0?search=a&b=c&d#hash');
    });
    it('should set to empty path on null value', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.path('/foo');
      expect(wrapper.path()).toBe('/foo');
      wrapper.path(null);
      expect(wrapper.path()).toBe('/');
    });
  });

  describe('search', () => {
    it('should accept string', function () {
      locationService.push('/path/b');
      wrapper.search('x=y&c');
      expect(wrapper.search()).toEqual({ x: 'y', c: true });
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?x=y&c');
    });

    it('search() should accept object', function () {
      locationService.push('/path/b');
      wrapper.search({ one: '1', two: true });
      expect(wrapper.search()).toEqual({ one: '1', two: true });
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?one=1&two');
    });

    it('should copy object', function () {
      locationService.push('/path/b');
      const obj: Record<string, any> = { one: '1', two: true, three: null };
      wrapper.search(obj);
      expect(obj).toEqual({ one: '1', two: true, three: null });
      obj.one = 'changed';

      expect(wrapper.search()).toEqual({ one: '1', two: true });
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?one=1&two');
    });

    it('should change single parameter', function () {
      wrapper.search({ id: 'old', preserved: true });
      wrapper.search('id', 'new');

      expect(wrapper.search()).toEqual({ id: 'new', preserved: true });
    });

    it('should remove single parameter', function () {
      wrapper.search({ id: 'old', preserved: true });
      wrapper.search('id', null);

      expect(wrapper.search()).toEqual({ preserved: true });
    });

    it('should remove multiple parameters', function () {
      locationService.push('/path/b');
      wrapper.search({ one: '1', two: true });
      expect(wrapper.search()).toEqual({ one: '1', two: true });

      wrapper.search({ one: null, two: null });
      expect(wrapper.search()).toEqual({});
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b');
    });

    it('should accept numeric keys', function () {
      locationService.push('/path/b');
      wrapper.search({ 1: 'one', 2: 'two' });
      expect(wrapper.search()).toEqual({ '1': 'one', '2': 'two' });
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?1=one&2=two');
    });

    it('should handle multiple value', function () {
      wrapper.search('a&b');
      expect(wrapper.search()).toEqual({ a: true, b: true });

      wrapper.search('a', null);

      expect(wrapper.search()).toEqual({ b: true });

      wrapper.search('b', undefined);
      expect(wrapper.search()).toEqual({});
    });

    it('should handle single value', function () {
      wrapper.search('ignore');
      expect(wrapper.search()).toEqual({ ignore: true });
      wrapper.search(1);
      expect(wrapper.search()).toEqual({ 1: true });
    });
  });

  describe('url', () => {
    it('should change the path, search and hash', function () {
      wrapper.url('/some/path?a=b&c=d#hhh');
      expect(wrapper.url()).toBe('/some/path?a=b&c=d#hhh');
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/some/path?a=b&c=d#hhh');
      expect(wrapper.path()).toBe('/some/path');
      expect(wrapper.search()).toEqual({ a: 'b', c: 'd' });
      expect(wrapper.hash()).toBe('hhh');
    });

    it('should change only hash when no search and path specified', function () {
      locationService.push('/path/b?search=a&b=c&d');
      wrapper.url('#some-hash');

      expect(wrapper.hash()).toBe('some-hash');
      expect(wrapper.url()).toBe('/path/b?search=a&b=c&d#some-hash');
      expect(wrapper.absUrl()).toBe('http://www.domain.com:9877/path/b?search=a&b=c&d#some-hash');
    });

    it('should change only search and hash when no path specified', function () {
      locationService.push('/path/b');
      wrapper.url('?a=b');

      expect(wrapper.search()).toEqual({ a: 'b' });
      expect(wrapper.hash()).toBe('');
      expect(wrapper.path()).toBe('/path/b');
    });

    it('should reset search and hash when only path specified', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.url('/new/path');

      expect(wrapper.path()).toBe('/new/path');
      expect(wrapper.search()).toEqual({});
      expect(wrapper.hash()).toBe('');
    });

    it('should change path when empty string specified', function () {
      locationService.push('/path/b?search=a&b=c&d#hash');
      wrapper.url('');

      expect(wrapper.path()).toBe('/');
      expect(wrapper.search()).toEqual({});
      expect(wrapper.hash()).toBe('');
    });
  });
});
