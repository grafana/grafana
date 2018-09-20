import { LinkSrv } from '../link_srv';
import _ from 'lodash';

jest.mock('angular', () => {
  const AngularJSMock = require('test/mocks/angular');
  return new AngularJSMock();
});

describe('linkSrv', () => {
  let linkSrv;
  const templateSrvMock = {};
  const timeSrvMock = {};

  beforeEach(() => {
    linkSrv = new LinkSrv(templateSrvMock, timeSrvMock);
  });

  describe('when appending query strings', () => {
    it('add ? to URL if not present', () => {
      const url = linkSrv.appendToQueryString('http://example.com', 'foo=bar');
      expect(url).toBe('http://example.com?foo=bar');
    });

    it('do not add & to URL if ? is present but query string is empty', () => {
      const url = linkSrv.appendToQueryString('http://example.com?', 'foo=bar');
      expect(url).toBe('http://example.com?foo=bar');
    });

    it('add & to URL if query string is present', () => {
      const url = linkSrv.appendToQueryString('http://example.com?foo=bar', 'hello=world');
      expect(url).toBe('http://example.com?foo=bar&hello=world');
    });

    it('do not change the URL if there is nothing to append', () => {
      _.each(['', undefined, null], toAppend => {
        const url1 = linkSrv.appendToQueryString('http://example.com', toAppend);
        expect(url1).toBe('http://example.com');

        const url2 = linkSrv.appendToQueryString('http://example.com?', toAppend);
        expect(url2).toBe('http://example.com?');

        const url3 = linkSrv.appendToQueryString('http://example.com?foo=bar', toAppend);
        expect(url3).toBe('http://example.com?foo=bar');
      });
    });
  });
});
