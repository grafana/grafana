import { renderHook } from '@testing-library/react';

import {
  locationService,
  HistoryWrapper,
  useLocationService,
  LocationServiceProvider,
  setLocationServiceOrgIdGetter,
} from './LocationService';

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

  describe('orgId injection on push/replace', () => {
    beforeEach(() => {
      setLocationServiceOrgIdGetter(() => 7);
    });

    afterAll(() => {
      // disable the getter so other tests in this file aren't affected
      setLocationServiceOrgIdGetter(() => 0);
    });

    it('does not append orgId when the getter returns 0', () => {
      setLocationServiceOrgIdGetter(() => 0);
      locationService.push('/test');
      expect(locationService.getLocation().search).toBe('');
    });

    it('appends orgId to a string path without query', () => {
      locationService.push('/test');
      expect(locationService.getLocation().search).toBe('?orgId=7');
    });

    it('appends orgId with & to a string path that already has a query', () => {
      locationService.push('/test?foo=1');
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
    });

    it('places orgId before the fragment on a string path', () => {
      locationService.push('/test#section');
      expect(locationService.getLocation().search).toBe('?orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('places orgId before the fragment when the string path has a query', () => {
      locationService.push('/test?foo=1#section');
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('leaves a string path unchanged when orgId is already present', () => {
      locationService.push('/test?orgId=3');
      expect(locationService.getLocation().search).toBe('?orgId=3');
    });

    it('appends orgId to the search of a LocationDescriptor object', () => {
      locationService.push({ pathname: '/test', search: '?foo=1', hash: '#section' });
      expect(locationService.getLocation().search).toBe('?foo=1&orgId=7');
      expect(locationService.getLocation().hash).toBe('#section');
    });

    it('leaves a LocationDescriptor object unchanged when orgId is already present', () => {
      locationService.push({ pathname: '/test', search: '?orgId=3' });
      expect(locationService.getLocation().search).toBe('?orgId=3');
    });

    it('also applies to replace()', () => {
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
