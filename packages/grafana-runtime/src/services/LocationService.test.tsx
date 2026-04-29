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
    beforeEach(() => {
      locationService.setOrgIdGetter(() => 7);
    });

    afterAll(() => {
      // disable the getter so other tests in this file aren't affected
      locationService.setOrgIdGetter(() => 0);
    });

    it('returns input unchanged when getter returns 0 / negative / NaN', () => {
      locationService.setOrgIdGetter(() => 0);
      expect(locationService.appendOrgId('/p')).toBe('/p');
      locationService.setOrgIdGetter(() => -1);
      expect(locationService.appendOrgId('/p')).toBe('/p');
      locationService.setOrgIdGetter(() => NaN);
      expect(locationService.appendOrgId('/p')).toBe('/p');
    });

    it('appends orgId to a bare string path', () => {
      expect(locationService.appendOrgId('/p')).toBe('/p?orgId=7');
    });

    it('appends orgId with & when the string path already has a query', () => {
      expect(locationService.appendOrgId('/p?a=1')).toBe('/p?a=1&orgId=7');
    });

    it('places orgId before the fragment on a bare string path', () => {
      expect(locationService.appendOrgId('/p#h')).toBe('/p?orgId=7#h');
    });

    it('places orgId before the fragment when the string path has a query', () => {
      expect(locationService.appendOrgId('/p?a=1#h')).toBe('/p?a=1&orgId=7#h');
    });

    it('leaves a string path unchanged when orgId is already present', () => {
      expect(locationService.appendOrgId('/p?orgId=3')).toBe('/p?orgId=3');
    });

    it('does not false-match notOrgId=', () => {
      expect(locationService.appendOrgId('/p?notOrgId=5')).toBe('/p?notOrgId=5&orgId=7');
    });

    it('floors fractional orgId', () => {
      locationService.setOrgIdGetter(() => 7.9);
      expect(locationService.appendOrgId('/p')).toBe('/p?orgId=7');
    });

    it('appends orgId to a LocationDescriptor without a search property', () => {
      expect(locationService.appendOrgId({ pathname: '/p' })).toEqual({
        pathname: '/p',
        search: '?orgId=7',
      });
    });

    it('appends orgId to a LocationDescriptor with only a hash', () => {
      expect(locationService.appendOrgId({ pathname: '/p', hash: '#h' })).toEqual({
        pathname: '/p',
        search: '?orgId=7',
        hash: '#h',
      });
    });

    it('appends orgId to a LocationDescriptor with a search', () => {
      expect(locationService.appendOrgId({ pathname: '/p', search: '?a=1' })).toEqual({
        pathname: '/p',
        search: '?a=1&orgId=7',
      });
    });

    it('leaves a LocationDescriptor unchanged when orgId is already present', () => {
      expect(locationService.appendOrgId({ pathname: '/p', search: '?orgId=3' })).toEqual({
        pathname: '/p',
        search: '?orgId=3',
      });
    });
  });

  describe('orgId injection on push/replace', () => {
    beforeEach(() => {
      locationService.setOrgIdGetter(() => 7);
    });

    afterAll(() => {
      locationService.setOrgIdGetter(() => 0);
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
