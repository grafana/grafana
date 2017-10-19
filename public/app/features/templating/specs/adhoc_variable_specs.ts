import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {AdhocVariable} from '../adhoc_variable';

describe('AdhocVariable', function() {

  describe('when serializing to url', function() {

    it('should set return key value and op seperated by pipe', function() {
      var variable = new AdhocVariable({
        filters: [
          {key: 'key1', operator: '=', value: 'value1'},
          {key: 'key2', operator: '!=', value: 'value2'},
          {key: 'key3', operator: '=', value: 'value3a|value3b'},
        ]
      });
      var urlValue = variable.getValueForUrl();
      expect(urlValue).to.eql(["key1|=|value1", "key2|!=|value2", "key3|=|value3a__gfp__value3b"]);
    });

  });

  describe('when deserializing from url', function() {

    it('should restore filters', function() {
      var variable = new AdhocVariable({});
      variable.setValueFromUrl(["key1|=|value1", "key2|!=|value2", "key3|=|value3a__gfp__value3b"]);

      expect(variable.filters[0].key).to.be('key1');
      expect(variable.filters[0].operator).to.be('=');
      expect(variable.filters[0].value).to.be('value1');

      expect(variable.filters[1].key).to.be('key2');
      expect(variable.filters[1].operator).to.be('!=');
      expect(variable.filters[1].value).to.be('value2');

      expect(variable.filters[2].key).to.be('key3');
      expect(variable.filters[2].operator).to.be('=');
      expect(variable.filters[2].value).to.be('value3a|value3b');
    });

  });

});

