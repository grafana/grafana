import { LinkSrv } from '../link_srv';
import _ from 'lodash';

jest.mock('angular', () => {
  let AngularJSMock = require('test/mocks/angular');
  return new AngularJSMock();
});

describe('linkSrv', function() {
  var linkSrv;
  var templateSrvMock = {};
  var timeSrvMock = {};

  beforeEach(() => {
    linkSrv = new LinkSrv(templateSrvMock, timeSrvMock);
  });

  describe('when appending query strings', function() {
    it('add ? to URL if not present', function() {
      var url = linkSrv.appendToQueryString('http://example.com', 'foo=bar');
      expect(url).toBe('http://example.com?foo=bar');
    });

    it('do not add & to URL if ? is present but query string is empty', function() {
      var url = linkSrv.appendToQueryString('http://example.com?', 'foo=bar');
      expect(url).toBe('http://example.com?foo=bar');
    });

    it('add & to URL if query string is present', function() {
      var url = linkSrv.appendToQueryString('http://example.com?foo=bar', 'hello=world');
      expect(url).toBe('http://example.com?foo=bar&hello=world');
    });

    it('do not change the URL if there is nothing to append', function() {
      _.each(['', undefined, null], function(toAppend) {
        var url1 = linkSrv.appendToQueryString('http://example.com', toAppend);
        expect(url1).toBe('http://example.com');

        var url2 = linkSrv.appendToQueryString('http://example.com?', toAppend);
        expect(url2).toBe('http://example.com?');

        var url3 = linkSrv.appendToQueryString('http://example.com?foo=bar', toAppend);
        expect(url3).toBe('http://example.com?foo=bar');
      });
    });
  });
});
