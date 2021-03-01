import { locationService } from './LocationService';

describe('LocationService', () => {
  describe('getSearchObject', () => {
    it('returns query string as object', () => {
      locationService.push('/test?query1=false&query2=123&query3=text');

      expect(locationService.getSearchObject()).toMatchInlineSnapshot(`
      Object {
        "query1": false,
        "query2": "123",
        "query3": "text",
      }
    `);
    });
    it('returns query string as object1', () => {
      locationService.push('/explore?orgId=1&left=%5B"now-1h","now","prom-1",%7B%7D%5D');

      expect(locationService.getSearchObject()).toMatchInlineSnapshot(`
      Object {
        "query1": false,
        "query2": "123",
        "query3": "text",
      }
    `);
    });
  });
});
