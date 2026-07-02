import { renderHook } from '@testing-library/react';

import { locationService, HistoryWrapper, useLocationService, LocationServiceProvider } from './LocationService';

describe('LocationService', () => {
  describe('getSearchObject', () => {
    it('returns query string as object', () => {
      locationService.push('/test?query1=false&query2=123&query3=text');

      expect(locationService.getSearchObject()).toEqual({
        query1: false,
        query2: '123',
        query3: 'text',
      });
    });

    it('returns keys added multiple times as an array', () => {
      locationService.push('/test?servers=A&servers=B&servers=C');

      expect(locationService.getSearchObject()).toEqual({
        servers: ['A', 'B', 'C'],
      });
    });
  });

  describe('partial', () => {
    it('should handle removing params and updating', () => {
      locationService.push('/test?query1=false&query2=123&query3=text');
      locationService.partial({ query1: null, query2: 'update' });

      expect(locationService.getLocation().search).toBe('?query2=update&query3=text');
    });

    it('should handle array values', () => {
      locationService.push('/');
      locationService.partial({ servers: ['A', 'B', 'C'] });

      expect(locationService.getLocation().search).toBe('?servers=A&servers=B&servers=C');
    });

    it('should handle boolean string values', () => {
      locationService.push('/?query1=false&query2=true&query3');
      locationService.partial({ newProp: 'a' });

      expect(locationService.getLocation().search).toBe('?query1=false&query2=true&query3=true&newProp=a');
    });

    it('persist state', () => {
      locationService.push({
        pathname: '/d/123',
        state: {
          some: 'stateToPersist',
        },
      });
      locationService.partial({ q: 1 });

      expect(locationService.getLocation().search).toBe('?q=1');
      expect(locationService.getLocation().state).toEqual({
        some: 'stateToPersist',
      });
    });
  });

  describe('appendOrgId', () => {
    const wrapper = locationService as HistoryWrapper;

    beforeEach(() => {
      wrapper.setOrgIdGetter(() => 7);
    });

    afterAll(() => {
      wrapper.setOrgIdGetter(() => 0);
    });

    it('returns input unchanged when getter returns 0 / negative / NaN', () => {
      wrapper.setOrgIdGetter(() => 0);
      expect(wrapper.appendOrgId('/p')).toBe('/p');
      wrapper.setOrgIdGetter(() => -1);
      expect(wrapper.appendOrgId('/p')).toBe('/p');
      wrapper.setOrgIdGetter(() => NaN);
      expect(wrapper.appendOrgId('/p')).toBe('/p');
    });

    it('appends orgId to a bare string path', () => {
      expect(wrapper.appendOrgId('/p')).toEqual({ pathname: '/p', search: '?orgId=7', hash: '' });
    });

    it('appends orgId with & when the string path already has a query', () => {
      expect(wrapper.appendOrgId('/p?a=1')).toEqual({ pathname: '/p', search: '?a=1&orgId=7', hash: '' });
    });

    it('preserves the fragment on a bare string path', () => {
      expect(wrapper.appendOrgId('/p#h')).toEqual({ pathname: '/p', search: '?orgId=7', hash: '#h' });
    });

    it('preserves the fragment when the string path has a query', () => {
      expect(wrapper.appendOrgId('/p?a=1#h')).toEqual({ pathname: '/p', search: '?a=1&orgId=7', hash: '#h' });
    });

    it('leaves a string path unchanged when orgId is already present', () => {
      expect(wrapper.appendOrgId('/p?orgId=3')).toBe('/p?orgId=3');
    });

    it('does not false-match notOrgId=', () => {
      expect(wrapper.appendOrgId('/p?notOrgId=5')).toEqual({
        pathname: '/p',
        search: '?notOrgId=5&orgId=7',
        hash: '',
      });
    });

    it('floors fractional orgId', () => {
      wrapper.setOrgIdGetter(() => 7.9);
      expect(wrapper.appendOrgId('/p')).toEqual({ pathname: '/p', search: '?orgId=7', hash: '' });
    });

    it('appends orgId to a LocationDescriptor without a search property', () => {
      expect(wrapper.appendOrgId({ pathname: '/p' })).toEqual({
        pathname: '/p',
        search: '?orgId=7',
      });
    });

    it('appends orgId to a LocationDescriptor with only a hash', () => {
      expect(wrapper.appendOrgId({ pathname: '/p', hash: '#h' })).toEqual({
        pathname: '/p',
        search: '?orgId=7',
        hash: '#h',
      });
    });

    it('appends orgId to a LocationDescriptor with a search', () => {
      expect(wrapper.appendOrgId({ pathname: '/p', search: '?a=1' })).toEqual({
        pathname: '/p',
        search: '?a=1&orgId=7',
      });
    });

    it('leaves a LocationDescriptor unchanged when orgId is already present', () => {
      expect(wrapper.appendOrgId({ pathname: '/p', search: '?orgId=3' })).toEqual({
        pathname: '/p',
        search: '?orgId=3',
      });
    });
  });

  describe('orgId injection on push/replace', () => {
    const wrapper = locationService as HistoryWrapper;

    beforeEach(() => {
      wrapper.setOrgIdGetter(() => 7);
    });

    afterAll(() => {
      wrapper.setOrgIdGetter(() => 0);
    });

    it('push() injects orgId into a string path with fragment', () => {
      locationService.push('/test?foo=1#section');
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('push() injects orgId into a LocationDescriptor', () => {
      locationService.push({ pathname: '/test', search: '?foo=1', hash: '#section' });
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('replace() injects orgId the same way', () => {
      locationService.replace('/test?foo=1#section');
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('detached history.push call (as react-router <Link> does) still injects orgId', () => {
      const history = wrapper.getHistory();
      // react-router does: const method = history.push; method(loc)
      const detachedPush = history.push;
      detachedPush('/test?foo=1');
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
    });

    it('partial() injects orgId when the current url lacks it', () => {
      // Reset to a path without orgId
      wrapper.setOrgIdGetter(() => 0);
      locationService.push('/test?foo=1');
      wrapper.setOrgIdGetter(() => 7);
      locationService.partial({ bar: 2 });
      expect(locationService.getLocation().search).toBe('?foo=1&bar=2&orgId=7');
    });

    it('createHref injects orgId so rendered <a href> values are shareable', () => {
      const href = wrapper.createHref({ pathname: '/test', search: '?foo=1' });
      expect(href).toContain('orgId=7');
      expect(href).toContain('foo=1');
    });
  });

  describe('hook access', () => {
    it('can set and access service from a context', () => {
      const locationServiceLocal = new HistoryWrapper();
      const wrapper: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => (
        <LocationServiceProvider service={locationServiceLocal}>{children}</LocationServiceProvider>
      );
      const hookResult = renderHook(() => useLocationService(), { wrapper });
      expect(hookResult.result.current).toBe(locationServiceLocal);
    });
  });
});
