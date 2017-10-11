import {describe, beforeEach, it, expect, angularMocks} from 'test/lib/common';
import 'app/features/panellinks/linkSrv';
import _ from  'lodash';

describe('linkSrv', function() {
  var _linkSrv;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));

  beforeEach(angularMocks.inject(function(linkSrv) {
    _linkSrv = linkSrv;
  }));

  describe('when appending query strings', function() {

    it('add ? to URL if not present', function() {
      var url = _linkSrv.appendToQueryString('http://example.com', 'foo=bar');
      expect(url).to.be('http://example.com?foo=bar');
    });

    it('do not add & to URL if ? is present but query string is empty', function() {
      var url = _linkSrv.appendToQueryString('http://example.com?', 'foo=bar');
      expect(url).to.be('http://example.com?foo=bar');
    });

    it('add & to URL if query string is present', function() {
      var url = _linkSrv.appendToQueryString('http://example.com?foo=bar', 'hello=world');
      expect(url).to.be('http://example.com?foo=bar&hello=world');
    });

    it('do not change the URL if there is nothing to append', function() {
      _.each(['', undefined, null], function(toAppend) {
        var url1 = _linkSrv.appendToQueryString('http://example.com', toAppend);
        expect(url1).to.be('http://example.com');

        var url2 = _linkSrv.appendToQueryString('http://example.com?', toAppend);
        expect(url2).to.be('http://example.com?');

        var url3 = _linkSrv.appendToQueryString('http://example.com?foo=bar', toAppend);
        expect(url3).to.be('http://example.com?foo=bar');
      });
    });

  });
});
