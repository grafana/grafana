import { locationService } from './LocationService';

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
});
