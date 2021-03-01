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
  });
});
